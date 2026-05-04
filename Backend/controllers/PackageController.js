const { errorResponse } = require('../utils/response');
const { normalizeString } = require('../utils/sanitize');
const { generateUUIDv7 } = require('../utils/cryptoUtils');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const ProjectRepository = require('../repositories/ProjectRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const DocumentRepository = require('../repositories/DocumentRepository');
const DocumentFolderRepository = require('../repositories/DocumentFolderRepository');
const UploadJobRepository = require('../repositories/UploadJobRepository');
const UploadApprovalRepository = require('../repositories/UploadApprovalRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const { publishPackageUpload } = require('../queues/packageUploadQueue');
const { publishIfcConversionJob } = require('../queues/ifcConversionQueue');
const { createSignedXktUrl, uploadIfcBuffer, buildSupabaseIfcPath, uploadProjectFileBuffer, buildProjectFilePath, SUPABASE_URL } = require('../services/supabaseStorageService');
const { s3Client, S3_BUCKET, S3_ENDPOINT, STORAGE_PROVIDER, buildS3Url, assertS3Configured } = require('../config/s3');
const { broadcastProject, broadcastPackage, notifyUser } = require('../services/socketService');
const ActivityService = require('../services/activityService');
const DiscordService = require('../services/discordService');
const User = require('../models/User');
const Task = require('../models/Task');
const Document = require('../models/Document');
const {
    computeDoneStatuses,
    evaluatePackageLifecycle,
    normalizeTaskStatus,
} = require('../utils/packageLifecycle');

const sendDiscordForDoc = async (projectId, userId, type, targetName, metadata = {}) => {
    try {
        const Project = require('../models/Project');
        const project = await Project.findOne({ publicId: projectId }).select('name integrations').lean();
        if (!project || !project.integrations?.discordEnabled || !project.integrations?.discordWebhook) return;

        const actor = userId ? await User.findById(userId).select('fullName email').lean() : null;
        const userName = actor?.fullName || actor?.email || 'System';

        await DiscordService.sendWebhook(project.integrations.discordWebhook, {
            projectName: project.name,
            userName,
            type,
            targetName,
            metadata,
        });
    } catch { /* silent */ }
};

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res, message) => errorResponse(res, 403, message || 'Forbidden');
const notFound = (res, message) => errorResponse(res, 404, message || 'Not found');
const serverError = (res, message) => errorResponse(res, 500, message || 'Internal server error');

function parseDueDate(dueDate) {
    if (dueDate === undefined || dueDate === null) return null;
    if (typeof dueDate !== 'string' && !(dueDate instanceof Date)) return null;
    const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

const SYNC_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const IFC_EXTENSION = '.ifc';

/**
 * Reads IFC file header to extract lightweight metadata for duplicate detection.
 * Reads only the first ~20KB which contains schema name, project name, and other identifiers.
 * This avoids loading the entire file into memory for large IFC files.
 */
function extractIfcMetadata(buffer) {
    try {
        const readSize = Math.min(buffer.length, 20 * 1024);
        const content = buffer.toString('utf8', 0, readSize);
        const result = { schema: '', projectName: '', creator: '', fileDescription: '' };

        // Extract FILE_SCHEMA — handle both IFC2X3 and IFC4X3 RC4 etc.
        const schemaMatch = content.match(/FILE_SCHEMA\s*\(\s*IFC([A-Za-z0-9_xX]+)/i);
        if (schemaMatch) result.schema = `IFC${schemaMatch[1].toUpperCase()}`;

        // Extract IFCPROJECT name
        const projectNameMatch = content.match(/IFCPROJECT[^\(]*\([^\)]*NAME\s*\(\s*'([^']*)'/i);
        if (projectNameMatch) result.projectName = projectNameMatch[1].trim();

        // Extract FILE_NAME for creator/author
        const creatorMatch = content.match(/FILE_NAME\s*\([^,]*,\s*'([^']*)'/i);
        if (creatorMatch) result.creator = creatorMatch[1].trim();

        // Extract FILE_DESCRIPTION for additional context
        const descMatch = content.match(/FILE_DESCRIPTION\s*\([^)]*DESCRIPTION\s*\(\s*\(\s*'([^']*)'/i);
        if (descMatch) result.fileDescription = descMatch[1].trim();

        return result;
    } catch {
        return { schema: '', projectName: '', creator: '', fileDescription: '' };
    }
}

/**
 * Compares two IFC metadata objects. Returns true if files are functionally identical.
 * Uses normalized comparison to be more tolerant of whitespace/case differences.
 */
function ifcMetadataEqual(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    const norm = (s) => String(s || '').trim().toLowerCase();
    return (
        norm(a.schema) === norm(b.schema) &&
        norm(a.projectName) === norm(b.projectName) &&
        norm(a.creator) === norm(b.creator)
    );
}

/**
 * Finds an existing document with the same name in the same folder scope.
 * Groups files with the same name into the same version group (regardless of size).
 */
async function findDuplicateDocument({ projectId, packageId, folderPath, fileName, fileSize, fileBuffer, isIfc }) {
    const existingDocs = await DocumentRepository.listByProjectPackageAndPath({ projectId, packageId, folderPath });

    for (const doc of existingDocs) {
        if (doc.originalName.toLowerCase() !== fileName.toLowerCase()) continue;

        if (isIfc) {
            const docMeta = doc._ifcMeta || { schema: '', projectName: '', creator: '' };
            const newMeta = extractIfcMetadata(fileBuffer);
            if (ifcMetadataEqual(docMeta, newMeta)) return doc;
        } else {
            return doc;
        }
    }

    return null;
}

/**
 * Formats a version number (float) into a display label.
 * e.g. 1.0 → "v1.0.0", 1.1 → "v1.1.0", 1.02 → "v1.0.0", 1.2 → "v1.2.0"
 * Uses versionLabel from DB if available, otherwise derives from versionNumber.
 */
function formatVersionLabel(versionNumber, dbVersionLabel) {
    if (dbVersionLabel && dbVersionLabel.trim()) return dbVersionLabel.trim();
    if (!versionNumber) return 'v1.0.0';
    const major = Math.floor(versionNumber);
    const minor = Math.round((versionNumber - major) * 100);
    const safeMinor = Math.min(99, Math.max(0, minor));
    return `v${major}.${safeMinor}`;
}

/**
 * Computes the next semantic version number.
 * Supports major.minor format (e.g. 1.0→1.1, 1.9→2.0, 1.99→2.0).
 * Max minor is 99; when reaching 99, increments major.
 */
function nextVersion(prevNumber) {
    if (!prevNumber || prevNumber < 1) return 1.2;
    const major = Math.floor(prevNumber);
    const minor = Math.round((prevNumber - major) * 100);
    if (minor >= 99) return major + 1.2;
    return parseFloat(`${major}.${minor + 1}`);
}

async function buildPackageLifecycleMap(projectId, packageIds = [], packageRows = []) {
    const normalizedIds = [...new Set((packageIds || []).filter(Boolean))];
    if (normalizedIds.length === 0) return new Map();

    const Project = require('../models/Project');
    const project = await Project.findOne({ publicId: projectId }).select('workflow.stages').lean();
    const stages = Array.isArray(project?.workflow?.stages) ? project.workflow.stages : [];
    const doneStatuses = computeDoneStatuses(stages);

    const [taskAgg, docAgg] = await Promise.all([
        Task.aggregate([
            { $match: { projectId, packageId: { $in: normalizedIds } } },
            {
                $group: {
                    _id: '$packageId',
                    taskTotal: { $sum: 1 },
                    doneTaskTotal: {
                        $sum: {
                            $cond: [
                                { $in: [{ $toLower: '$status' }, [...doneStatuses]] },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        Document.aggregate([
            { $match: { projectId, packageId: { $in: normalizedIds } } },
            { $group: { _id: '$packageId', documentTotal: { $sum: 1 } } },
        ]),
    ]);

    const taskMap = new Map(taskAgg.map((row) => [String(row._id), row]));
    const docMap = new Map(docAgg.map((row) => [String(row._id), row]));
    const lifecycleMap = new Map();

    for (const pkg of packageRows || []) {
        const pid = String(pkg.publicId || '');
        if (!pid) continue;
        const taskStat = taskMap.get(pid);
        const docStat = docMap.get(pid);
        const memberSet = new Set([
            ...(Array.isArray(pkg.teamMemberIds) ? pkg.teamMemberIds : []),
            ...(pkg.creatorId ? [pkg.creatorId] : []),
        ]);
        lifecycleMap.set(
            pid,
            evaluatePackageLifecycle({
                dbStatus: pkg.status,
                taskTotal: Number(taskStat?.taskTotal || 0),
                doneTaskTotal: Number(taskStat?.doneTaskTotal || 0),
                documentTotal: Number(docStat?.documentTotal || 0),
                memberTotal: memberSet.size,
            })
        );
    }

    return lifecycleMap;
}

async function evaluateSinglePackageLifecycle(projectId, pkg) {
    const packageId = pkg?.publicId;
    if (!packageId) {
        return evaluatePackageLifecycle({ dbStatus: pkg?.status || 'Draft' });
    }
    const Project = require('../models/Project');
    const project = await Project.findOne({ publicId: projectId }).select('workflow.stages').lean();
    const stages = Array.isArray(project?.workflow?.stages) ? project.workflow.stages : [];
    const doneStatuses = computeDoneStatuses(stages);

    const [tasks, docs] = await Promise.all([
        Task.find({ projectId, packageId }, { status: 1 }).lean(),
        DocumentRepository.listByProjectAndPackage(projectId, packageId),
    ]);
    const doneTaskTotal = tasks.reduce(
        (acc, task) => acc + (doneStatuses.has(normalizeTaskStatus(task?.status)) ? 1 : 0),
        0
    );
    const memberSet = new Set([
        ...(Array.isArray(pkg.teamMemberIds) ? pkg.teamMemberIds : []),
        ...(pkg.creatorId ? [pkg.creatorId] : []),
    ]);
    return evaluatePackageLifecycle({
        dbStatus: pkg.status,
        taskTotal: tasks.length,
        doneTaskTotal,
        documentTotal: docs.length,
        memberTotal: memberSet.size,
    });
}

function normalizeFolderType(folderType) {
    const value = normalizeString(folderType)?.toLowerCase();
    return value === 'images' ? 'images' : 'files';
}

function normalizeFolderPath(folderPath) {
    const raw = normalizeString(folderPath);
    if (!raw) return '';

    return raw
        .replace(/\\+/g, '/')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
            if (!segment) return '';
            const cleaned = segment.replace(/[<>:"|?*]/g, '');
            return cleaned || `folder-${Date.now()}`;
        })
        .filter(Boolean)
        .join('/');
}

const VIETNAMESE_MAP = {
    à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
    ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
    â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
    đ: 'd',
    è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
    ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
    ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
    ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
    ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
    ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
    ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
    ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
    ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
    À: 'A', Á: 'A', Ả: 'A', Ã: 'A', Ạ: 'A',
    Ă: 'A', Ằ: 'A', Ắ: 'A', Ẳ: 'A', Ẵ: 'A', Ặ: 'A',
    Â: 'A', Ầ: 'A', Ấ: 'A', Ẩ: 'A', Ẫ: 'A', Ậ: 'A',
    Đ: 'D',
    È: 'E', É: 'E', Ẻ: 'E', Ẽ: 'E', Ẹ: 'E',
    Ê: 'E', Ề: 'E', Ế: 'E', Ể: 'E', Ễ: 'E', Ệ: 'E',
    Ì: 'I', Í: 'I', Ỉ: 'I', Ĩ: 'I', Ị: 'I',
    Ò: 'O', Ó: 'O', Ỏ: 'O', Õ: 'O', Ọ: 'O',
    Ô: 'O', Ồ: 'O', Ố: 'O', Ổ: 'O', Ỗ: 'O', Ộ: 'O',
    Ơ: 'O', Ờ: 'O', Ớ: 'O', Ở: 'O', Ỡ: 'O', Ợ: 'O',
    Ù: 'U', Ú: 'U', Ủ: 'U', Ũ: 'U', Ụ: 'U',
    Ư: 'U', Ừ: 'U', Ứ: 'U', Ử: 'U', Ữ: 'U', Ự: 'U',
    Ỳ: 'Y', Ý: 'Y', Ỷ: 'Y', Ỹ: 'Y', Ỵ: 'Y',
};

function removeDiacritics(str) {
    return str.replace(/[^\x00-\x7F]/g, (char) => VIETNAMESE_MAP[char] || char);
}

function normalizeFolderPathForS3(folderPath) {
    const raw = normalizeString(folderPath);
    if (!raw) return '';

    return raw
        .replace(/\\+/g, '/')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
            if (!segment) return '';
            const cleaned = segment.replace(/[<>:"|?*]/g, '');
            const ascii = removeDiacritics(cleaned);
            return ascii.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || `folder-${Date.now()}`;
        })
        .filter(Boolean)
        .join('/');
}

function getStorageProvider() {
    return normalizeString(STORAGE_PROVIDER) || 's3';
}

function buildStorageKey({ projectId, packageId, folderType, folderPath, originalName, packageName }) {
    const ext = path.extname(originalName || '').toLowerCase();
    // Sanitize filename: remove all non-alphanumeric except hyphens/underscores, collapse to single hyphens
    const rawBase = path.basename(originalName || 'file', ext);
    const safeBase = rawBase
        .replace(/[^a-zA-Z0-9\s\-_]/g, '-')
        .replace(/[\s\-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'file';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const normalizedPath = normalizeFolderPathForS3(folderPath);
    const prefix = normalizedPath ? `${normalizedPath}/` : '';

    // Join base + unique with exactly one hyphen, avoiding -- patterns
    const filename = `${safeBase}-${unique}${ext}`.replace(/--+/g, '-');

    if (!packageId) {
        return `projects/${projectId}/root/${folderType}/${prefix}${filename}`;
    }

    const safePackageName = (normalizeString(packageName) || 'package')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    return `projects/${projectId}/${safePackageName}-${packageId}/${folderType}/${prefix}${filename}`;
}

async function validatePackageDocumentAccess({ projectId, packageId, userId, allowViewer = true }) {
    const member = await ProjectMemberRepository.findMember(projectId, userId);
    if (!member || member.status !== 'accepted') {
        return { ok: false, status: 403, message: 'Only project members can access package documents' };
    }

    if (!allowViewer && member.role === 'viewer') {
        return { ok: false, status: 403, message: 'Viewers do not have document management permission' };
    }

    if (!packageId) {
        return { ok: true, member, pkg: null };
    }

    const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
    if (!pkg || pkg.status === 'Archived') {
        return { ok: false, status: 404, message: 'Package not found or is archived' };
    }

    const canAccessPackage = member.role === 'admin'
        || pkg.creatorId === userId
        || (pkg.teamMemberIds || []).includes(userId);

    if (!canAccessPackage) {
        return { ok: false, status: 403, message: 'You do not have access to this package' };
    }

    return { ok: true, member, pkg };
}

function buildDocumentsTree({ docs, folders, rootName = 'All Files', rootId = 'root', versionCounts = new Map() }) {
    const treeMap = new Map();
    treeMap.set(rootId, {
        id: rootId,
        name: rootName,
        type: 'folder',
        children: [],
    });

    const ensureFolderNode = (parentKey, name, fullKey) => {
        if (treeMap.has(fullKey)) return treeMap.get(fullKey);

        const node = {
            id: fullKey,
            name,
            type: 'folder',
            icon: 'folder',
            children: [],
        };

        treeMap.set(fullKey, node);
        treeMap.get(parentKey).children.push(node);
        return node;
    };

    const resolveFolderChain = (folderPath = '') => {
        if (!folderPath) return rootId;

        const segments = String(folderPath)
            .split('/')
            .map((s) => s.trim())
            .filter(Boolean);

        let parentKey = rootId;
        let currentPath = rootId;

        for (const segment of segments) {
            currentPath = `${currentPath}/${segment}`;
            ensureFolderNode(parentKey, segment, currentPath);
            parentKey = currentPath;
        }

        return parentKey;
    };

    for (const folder of folders || []) {
        resolveFolderChain(folder.folderPath || '');
    }

    // Group docs by versionGroupId so we only show the latest version in the tree
    const latestByVersionGroup = new Map();
    for (const doc of docs || []) {
        const vgId = doc.versionGroupId || doc.publicId;
        const existing = latestByVersionGroup.get(vgId);
        if (!existing || doc.versionNumber > existing.versionNumber) {
            latestByVersionGroup.set(vgId, doc);
        }
    }

    for (const doc of latestByVersionGroup.values()) {
        const parentKey = resolveFolderChain(doc.folderPath || '');
        const vgId = doc.versionGroupId || doc.publicId;
        treeMap.get(parentKey).children.push({
            id: doc.publicId,
            name: doc.originalName,
            type: 'file',
            category: doc.mimeType?.startsWith('image/') ? 'Image' : 'File',
            size: `${Math.round((doc.size || 0) / 1024)} KB`,
            updatedAt: doc.updatedAt,
            author: doc.uploadedBy,
            mimeType: doc.mimeType || '',
            folderPath: doc.folderPath || '',
            s3Key: doc.s3Key,
            s3Url: doc.s3Url,
            versionNumber: doc.versionNumber || 1,
            versionLabel: doc.versionLabel || '',
            versionDescription: doc.versionDescription || '',
            versionGroupId: vgId,
            versionId: doc.publicId,
            versionCount: versionCounts.get(vgId) || 1,
            conversionStatus: doc.conversionStatus || 'NOT_SUPPORTED',
            conversionError: doc.conversionError || '',
            isIfc: path.extname(doc.originalName || '').toLowerCase() === IFC_EXTENSION,
            approvalStatus: doc.approvalStatus || 'approved',
        });
    }

    const sortNode = (node) => {
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return String(a.name).localeCompare(String(b.name));
        });

        for (const child of node.children) {
            if (child.type === 'folder') sortNode(child);
        }
    };

    const root = treeMap.get(rootId);
    sortNode(root);
    return root;
}

class PackageController {
/**
 * Returns all versions of a document given its versionGroupId.
 */
    async getDocumentVersions(req, res) {
        try {
            const { projectId, versionGroupId } = req.params || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedVersionGroupId = normalizeString(versionGroupId);

            if (!normalizedProjectId || !normalizedVersionGroupId) {
                return badRequest(res, 'projectId and versionGroupId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view document versions');
            }

            const Document = require('../models/Document');
            const User = require('../models/User');
            const versions = await Document.find({
                projectId: normalizedProjectId,
                versionGroupId: normalizedVersionGroupId,
            }).sort({ versionNumber: -1, _id: -1 });

            if (!versions || versions.length === 0) {
                return notFound(res, 'No versions found');
            }

            const uploaderIds = [...new Set(versions.map((v) => v.uploadedBy))];
            const validUploaderIds = uploaderIds.filter((id) => {
                try { return mongoose.Types.ObjectId.isValid(id); } catch { return false; }
            });
            let userMap = new Map();
            if (validUploaderIds.length > 0) {
                const users = await User.find({ _id: { $in: validUploaderIds } })
                    .select('publicId fullName avatar')
                    .lean();
                for (const u of users) userMap.set(String(u._id), u);
            }

            return res.status(200).json({
                success: true,
                data: {
                    versions: versions.map((v) => {
                        const uploader = userMap.get(String(v.uploadedBy));
                        return {
                            publicId: v.publicId,
                            originalName: v.originalName,
                            versionNumber: v.versionNumber,
                            versionLabel: formatVersionLabel(v.versionNumber, v.versionLabel),
                            versionDescription: v.versionDescription || '',
                            versionGroupId: v.versionGroupId,
                            uuidv7: v.uuidv7 || null,
                            size: v.size,
                            mimeType: v.mimeType,
                            s3Url: v.s3Url,
                            supabaseFileUrl: v.supabaseFileUrl || v.s3Url,
                            uploadedBy: v.uploadedBy,
                            uploadedByUser: uploader
                                ? {
                                      id: uploader.publicId,
                                      name: uploader.fullName,
                                      avatar: uploader.avatar || null,
                                  }
                                : null,
                            conversionStatus: v.conversionStatus,
                            approvalStatus: v.approvalStatus || 'approved',
                            createdAt: v.createdAt,
                            updatedAt: v.updatedAt,
                        };
                    }),
                },
            });
        } catch (error) {
            console.error('[getDocumentVersions] error:', error);
            return serverError(res, error.message || 'Failed to get document versions');
        }
    }

    /**
     * Restores a document to a previous version by creating a new version
     * that copies the content from the selected version.
     *
     * @param {boolean} skipIntermediate - When true, the new version number is computed as
     *   (source version number + 1), effectively placing the restored copy right after
     *   the source version. When false (default), the new version becomes (latest + 1),
     *   placing it after the current latest version.
     *   Example (v1, v2, v3, v4, v5 → restore v2):
     *   - skipIntermediate=false → creates v6 (after v5)
     *   - skipIntermediate=true  → creates v3 (after v2, preserving v3, v4, v5)
     */
    async restoreVersion(req, res) {
        try {
            const { projectId, versionGroupId, documentPublicId } = req.params || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedVersionGroupId = normalizeString(versionGroupId);
            const normalizedDocumentPublicId = normalizeString(documentPublicId);

            if (!normalizedProjectId || !normalizedVersionGroupId || !normalizedDocumentPublicId) {
                return badRequest(res, 'projectId, versionGroupId, and documentPublicId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can restore document versions');
            }

            const Document = require('../models/Document');
            const sourceDoc = await Document.findOne({
                publicId: normalizedDocumentPublicId,
                versionGroupId: normalizedVersionGroupId,
                projectId: normalizedProjectId,
            });

            if (!sourceDoc) {
                return notFound(res, 'Source version not found');
            }

            let nextVersionNumber;

            if (req.query.skipIntermediate === 'true') {
                nextVersionNumber = sourceDoc.versionNumber + 1;
            } else {
                const latest = await Document.findOne({ versionGroupId: normalizedVersionGroupId })
                    .sort({ versionNumber: -1 })
                    .lean();
                nextVersionNumber = latest ? latest.versionNumber + 1 : 1;
            }

            const newDoc = await Document.create({
                projectId: sourceDoc.projectId,
                packageId: sourceDoc.packageId,
                folderType: sourceDoc.folderType,
                folderPath: sourceDoc.folderPath,
                originalName: sourceDoc.originalName,
                storedName: sourceDoc.storedName,
                mimeType: sourceDoc.mimeType,
                size: sourceDoc.size,
                s3Bucket: sourceDoc.s3Bucket,
                s3Key: sourceDoc.s3Key,
                s3Url: sourceDoc.s3Url,
                supabaseFileKey: sourceDoc.supabaseFileKey,
                supabaseFileUrl: sourceDoc.supabaseFileUrl,
                uploadedBy: userId,
                versionGroupId: sourceDoc.versionGroupId,
                versionNumber: nextVersionNumber,
                versionLabel: formatVersionLabel(nextVersionNumber, ''),
                uuidv7: generateUUIDv7(),
                conversionStatus: sourceDoc.conversionStatus,
                xktBucket: sourceDoc.xktBucket,
                xktKey: sourceDoc.xktKey,
                xktUrl: sourceDoc.xktUrl,
                supabaseIfcKey: sourceDoc.supabaseIfcKey,
                conversionAttempts: 0,
                conversionError: '',
                convertedAt: null,
                approvalStatus: 'pending',
            });

            if (sourceDoc.conversionStatus === 'READY') {
                publishIfcConversionJob({
                    documentPublicId: newDoc.publicId,
                    projectId: newDoc.projectId,
                    skipIfExists: true,
                });
            }

            await sendDiscordForDoc(
                normalizedProjectId,
                userId,
                'DOCUMENT_RESTORED',
                sourceDoc.originalName,
                { restoredFromVersion: sourceDoc.versionNumber, newVersion: nextVersionNumber }
            );
            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: newDoc.packageId || null,
                action: 'version_restored',
                documentId: newDoc.publicId,
                versionGroupId: newDoc.versionGroupId,
            });

            return res.status(200).json({
                success: true,
                message: `Restored to version ${sourceDoc.versionNumber} as version ${nextVersionNumber}`,
                data: {
                    publicId: newDoc.publicId,
                    versionNumber: newDoc.versionNumber,
                    versionLabel: formatVersionLabel(newDoc.versionNumber, newDoc.versionLabel),
                    versionGroupId: newDoc.versionGroupId,
                },
            });
        } catch (error) {
            console.error('[restoreVersion] error:', error);
            return serverError(res, error.message || 'Failed to restore version');
        }
    }

    /**
     * Returns the suggested next version number and label for a given file.
     * Looks up the latest version by versionGroupId (from fileId) and computes nextVersion.
     * Falls back to "v1.0" for new files.
     */
    async getSuggestedVersion(req, res) {
        try {
            const { projectId, fileId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);

            if (!normalizedProjectId) return badRequest(res, 'projectId is required');

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view documents');
            }

            const Document = require('../models/Document');

            let versionNumber = 1;
            let versionLabel = 'v1.0.0';
            let versionGroupId = null;

            if (normalizedFileId) {
                const doc = await DocumentRepository.findByPublicId(normalizedFileId);
                if (doc && doc.projectId === normalizedProjectId) {
                    versionNumber = nextVersion(doc.versionNumber);
                    versionLabel = `v${versionNumber}`;
                    versionGroupId = doc.versionGroupId;
                }
            }

            return res.status(200).json({
                success: true,
                data: {
                    versionNumber,
                    versionLabel,
                    versionGroupId,
                },
            });
        } catch (error) {
            console.error('[getSuggestedVersion] error:', error);
            return serverError(res, error.message || 'Failed to get suggested version');
        }
    }

    /**
     * UC-PKG-001: Create New Package
     */
    async createPackage(req, res) {
        try {
            const {
                projectId,
                name,
                description,
                type,
                dueDate,
                teamMemberIds,
                status: statusBody,
                initialStatus,
            } = req.body || {};

            const normalizedProjectId = normalizeString(projectId);
            const normalizedName = normalizeString(name);

            if (!normalizedProjectId || !normalizedName) {
                return badRequest(res, 'projectId and name are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const project = await ProjectRepository.findByPublicId(normalizedProjectId);
            if (!project) return notFound(res, 'Project not found');

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can create packages');
            }
            if (member.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

            const existing = await PackageRepository.findByProjectIdAndName(
                normalizedProjectId,
                normalizedName
            );
            if (existing) {
                return badRequest(
                    res,
                    'A package with this name already exists in the project. Please use a unique name.'
                );
            }

            const normalizedTeamMemberIds = Array.isArray(teamMemberIds)
                ? teamMemberIds.map((id) => normalizeString(id)).filter(Boolean)
                : [];

            const rawInitialStatus = normalizeString(statusBody || initialStatus);
            const titleCaseStatus = rawInitialStatus
                ? `${rawInitialStatus.charAt(0).toUpperCase()}${rawInitialStatus.slice(1).toLowerCase()}`
                : '';
            const allowedCreateStatuses = ['Draft', 'Active'];
            const resolvedStatus = allowedCreateStatuses.includes(titleCaseStatus)
                ? titleCaseStatus
                : 'Draft';

            const packageDoc = await PackageRepository.create({
                projectId: normalizedProjectId,
                name: normalizedName,
                description: description != null ? normalizeString(description) : '',
                packageType: type != null ? normalizeString(type) : '',
                status: resolvedStatus,
                dueDate: parseDueDate(dueDate),
                creatorId: userId,
                teamMemberIds: normalizedTeamMemberIds,
                documentIds: [],
                taskIds: [],
                archivedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const packageData = {
                publicId: packageDoc.publicId,
                projectId: packageDoc.projectId,
                name: packageDoc.name,
                description: packageDoc.description,
                packageType: packageDoc.packageType,
                status: packageDoc.status,
                dueDate: packageDoc.dueDate,
                creatorId: packageDoc.creatorId,
                teamMemberIds: packageDoc.teamMemberIds,
                archivedAt: packageDoc.archivedAt || null,
                createdAt: packageDoc.createdAt,
                updatedAt: packageDoc.updatedAt,
            };

            broadcastPackage(packageDoc.publicId, 'package:created', {
                ...packageData,
                actorId: userId,
            });
            broadcastProject(normalizedProjectId, 'package:created', {
                ...packageData,
                actorId: userId,
            });

            // Notify package members
            if (normalizedTeamMemberIds.length > 0) {
                const creator = await User.findById(userId).select('fullName').lean();
                const creatorName = creator?.fullName || 'Someone';
                const packageLink = `/projects/${normalizedProjectId}/packages/${packageDoc.publicId}`;

                const userDocs = await User.find({ publicId: { $in: normalizedTeamMemberIds } }).select('_id publicId').lean();
                const mongoIdMap = new Map(userDocs.map(u => [u.publicId, String(u._id)]));

                for (const memberPublicId of normalizedTeamMemberIds) {
                    const mongoId = mongoIdMap.get(memberPublicId);
                    if (!mongoId || mongoId === userId) continue;
                    const notification = await NotificationRepository.create({
                        userId: mongoId,
                        type: 'info',
                        title: 'Added to package',
                        message: `${creatorName} added you to package "${packageDoc.name}"`,
                        link: packageLink,
                        read: false,
                        refType: 'package',
                        refId: packageDoc.publicId,
                    });
                    notifyUser(mongoId, 'notification:new', {
                        id: String(notification._id),
                        type: 'info',
                        title: 'Added to package',
                        message: `${creatorName} added you to package "${packageDoc.name}"`,
                        link: packageLink,
                        read: false,
                        createdAt: notification.createdAt.toISOString(),
                    });
                }
            }

            return res.status(201).json({
                success: true,
                message: 'Package created',
                data: packageData,
            });
        } catch (error) {
            if (error && error.code === 11000) {
                return badRequest(
                    res,
                    'A package with this name already exists in the project. Please use a unique name.'
                );
            }
            return serverError(res, error.message || 'Create package failed');
        }
    }

    /**
     * List packages
     * listType: 'active' (default), 'archived', 'all'
     */
    async listPackages(req, res) {
        try {
            const { projectId, listType } = req.body || {};

            const normalizedProjectId = normalizeString(projectId);
            if (!normalizedProjectId) return badRequest(res, 'projectId is required');

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view packages');
            }

            const scope =
                listType === 'archived' ? 'archived' : listType === 'all' ? 'all' : 'active';

            const packages = member.role === 'admin'
                ? await PackageRepository.listByProjectIdSorted(normalizedProjectId, scope)
                : await PackageRepository.listByProjectAndMember(normalizedProjectId, userId, scope);

            const lifecycleMap = await buildPackageLifecycleMap(
                normalizedProjectId,
                (packages || []).map((pkg) => pkg.publicId),
                packages
            );
            const enriched = (packages || []).map((pkg) => {
                const plain = typeof pkg.toObject === 'function' ? pkg.toObject() : pkg;
                const lifecycle = lifecycleMap.get(String(pkg.publicId))
                    || evaluatePackageLifecycle({ dbStatus: pkg.status });
                return {
                    ...plain,
                    lifecycleStatus: lifecycle.lifecycleStatus,
                    progress: lifecycle.progress,
                    completionCriteria: lifecycle.completionCriteria,
                };
            });

            return res.status(200).json({
                success: true,
                listType: scope,
                data: enriched,
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to load packages');
        }
    }

    async listProjectDocuments(req, res) {
        try {
            const { projectId, includePackages } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            if (!normalizedProjectId) return badRequest(res, 'projectId is required');

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view documents');
            }

            /** Project Documents tab: only files/folders without packageId. Pass includePackages: true for full tree (e.g. change requests / IFC pickers). */
            const wantAllPackages = includePackages === true || includePackages === 'true';

            const visiblePackages = wantAllPackages
                ? (member.role === 'admin'
                    ? await PackageRepository.listByProjectIdSorted(normalizedProjectId, 'all')
                    : await PackageRepository.listByProjectAndMember(normalizedProjectId, userId, 'all'))
                : [];

            const visiblePackageIds = new Set((visiblePackages || []).map((pkg) => pkg.publicId));

            const [docs, emptyFolders] = await Promise.all([
                DocumentRepository.listByProject(normalizedProjectId),
                DocumentFolderRepository.listByProject(normalizedProjectId),
            ]);

            const isProjectRootScope = (row) => {
                const pid = row?.packageId;
                return pid == null || pid === '';
            };

            let filteredDocs;
            let filteredFolders;
            if (wantAllPackages) {
                filteredDocs = (docs || []).filter(
                    (doc) =>
                        (!doc.packageId || visiblePackageIds.has(doc.packageId)) &&
                        doc.approvalStatus !== 'pending' &&
                        doc.approvalStatus !== 'rejected'
                );
                filteredFolders = (emptyFolders || []).filter(
                    (folder) => !folder.packageId || visiblePackageIds.has(folder.packageId)
                );
            } else {
                filteredDocs = (docs || []).filter(
                    (doc) =>
                        isProjectRootScope(doc) &&
                        doc.approvalStatus !== 'pending' &&
                        doc.approvalStatus !== 'rejected'
                );
                filteredFolders = (emptyFolders || []).filter(isProjectRootScope);
            }

            // Only create package nodes for packages that have at least one document or folder.
            // This prevents "phantom folders" from appearing every time a package is created.
            const packagesWithContent = new Set();
            for (const doc of filteredDocs) {
                if (doc.packageId) packagesWithContent.add(doc.packageId);
            }
            for (const folder of filteredFolders) {
                if (folder.packageId) packagesWithContent.add(folder.packageId);
            }

            const packageNameMap = new Map(
                (visiblePackages || []).map((pkg) => [pkg.publicId, pkg.name || `Package ${String(pkg.publicId).slice(0, 8)}`])
            );

            const treeMap = new Map();
            treeMap.set('root', {
                id: 'root',
                name: 'All Files',
                type: 'folder',
                children: [],
            });

            const ensureFolderNode = (parentKey, name, fullKey) => {
                if (treeMap.has(fullKey)) return treeMap.get(fullKey);
                const node = {
                    id: fullKey,
                    name,
                    type: 'folder',
                    icon: 'folder',
                    children: [],
                };
                treeMap.set(fullKey, node);
                treeMap.get(parentKey).children.push(node);
                return node;
            };

            const packageMap = new Map();
            const resolveScopeNode = (packageId) => {
                if (!packageId) return 'root';
                if (packageMap.has(packageId)) return packageMap.get(packageId);
                const pkgNodeKey = `root/pkg/${packageId}`;
                const pkgName = packageNameMap.get(packageId) || `Package ${String(packageId).slice(0, 8)}`;
                const node = ensureFolderNode('root', pkgName, pkgNodeKey);
                node.icon = 'package';
                packageMap.set(packageId, pkgNodeKey);
                return pkgNodeKey;
            };

            const resolveFolderChain = (packageId, folderPath = '') => {
                const scopeNodeKey = resolveScopeNode(packageId);

                if (!folderPath) return scopeNodeKey;

                const segments = String(folderPath)
                    .split('/')
                    .map((s) => s.trim())
                    .filter(Boolean);

                let parentKey = scopeNodeKey;
                let currentPath = scopeNodeKey;
                for (const segment of segments) {
                    currentPath = `${currentPath}/${segment}`;
                    ensureFolderNode(parentKey, segment, currentPath);
                    parentKey = currentPath;
                }
                return parentKey;
            };

            // Only create package nodes for packages that have actual content (docs or folders).
            // Empty packages won't show up in the Documents tab until user uploads a file/creates a folder.
            if (wantAllPackages) {
                for (const pkg of visiblePackages) {
                    if (packagesWithContent.has(pkg.publicId)) {
                        resolveScopeNode(pkg.publicId);
                    }
                }
            }

            for (const folder of filteredFolders) {
                resolveFolderChain(folder.packageId || null, folder.folderPath || '');
            }

            // Group docs by versionGroupId so we only show the latest version in the tree.
            // This avoids flooding the tree with multiple versions of the same file.
            const latestByVersionGroup = new Map();
            for (const doc of filteredDocs) {
                const vgId = doc.versionGroupId || doc.publicId;
                const existing = latestByVersionGroup.get(vgId);
                if (!existing || doc.versionNumber > existing.versionNumber) {
                    latestByVersionGroup.set(vgId, doc);
                }
            }

            // Compute version count per versionGroupId
            const versionCounts = await DocumentRepository.countVersionsByVersionGroupIds([...latestByVersionGroup.keys()]);

            for (const doc of latestByVersionGroup.values()) {
                const parentKey = resolveFolderChain(doc.packageId || null, doc.folderPath || '');
                const vgId = doc.versionGroupId || doc.publicId;

                treeMap.get(parentKey).children.push({
                    id: doc.publicId,
                    name: doc.originalName,
                    type: 'file',
                    category: doc.mimeType?.startsWith('image/') ? 'Image' : 'File',
                    size: `${Math.round((doc.size || 0) / 1024)} KB`,
                    updatedAt: doc.updatedAt,
                    author: doc.uploadedBy,
                    mimeType: doc.mimeType || '',
                    folderPath: doc.folderPath || '',
                    s3Key: doc.s3Key,
                    s3Url: doc.s3Url,
            versionNumber: doc.versionNumber || 1,
            versionLabel: doc.versionLabel || '',
            versionDescription: doc.versionDescription || '',
            versionGroupId: vgId,
            versionId: doc.publicId,
            versionCount: versionCounts.get(vgId) || 1,
                    conversionStatus: doc.conversionStatus || 'NOT_SUPPORTED',
                    conversionError: doc.conversionError || '',
                    isIfc: path.extname(doc.originalName || '').toLowerCase() === IFC_EXTENSION,
                    approvalStatus: doc.approvalStatus || 'approved',
                });
            }

            const sortNode = (node) => {
                node.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return String(a.name).localeCompare(String(b.name));
                });
                for (const child of node.children) {
                    if (child.type === 'folder') sortNode(child);
                }
            };

            const root = treeMap.get('root');
            sortNode(root);

            return res.status(200).json({
                success: true,
                data: {
                    tree: root,
                    total: filteredDocs.length,
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to load project documents');
        }
    }

    async listPackageDocuments(req, res) {
        try {
            const { projectId, packageId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const access = await validatePackageDocumentAccess({
                projectId: normalizedProjectId,
                packageId: normalizedPackageId,
                userId,
                allowViewer: true,
            });

            if (!access.ok) {
                if (access.status === 404) return notFound(res, access.message);
                return forbidden(res, access.message);
            }

            const [docs, folders] = await Promise.all([
                DocumentRepository.listByProjectAndPackage(normalizedProjectId, normalizedPackageId),
                DocumentFolderRepository.listByProjectAndPackage(normalizedProjectId, normalizedPackageId),
            ]);

            const approvedDocs = (docs || []).filter(
                (doc) => doc.approvalStatus !== 'pending' && doc.approvalStatus !== 'rejected'
            );

            // Compute version counts and latest version per group
            const allVgIds = [...new Set((docs || []).map((d) => d.versionGroupId || d.publicId))];
            const versionCounts = await DocumentRepository.countVersionsByVersionGroupIds(allVgIds);

            const rootId = `root/pkg/${normalizedPackageId}`;
            const root = buildDocumentsTree({
                docs: approvedDocs,
                folders,
                rootId,
                rootName: access.pkg?.name || 'Package Files',
                versionCounts,
            });
            root.icon = 'package';

            // Count unique files (latest versions only, approved only)
            const uniqueFileCount = (approvedDocs || []).filter((doc) => {
                const vgId = doc.versionGroupId || doc.publicId;
                const siblings = (approvedDocs || []).filter((d) => (d.versionGroupId || d.publicId) === vgId);
                return doc.versionNumber === Math.max(...siblings.map((d) => d.versionNumber));
            }).length;

            return res.status(200).json({
                success: true,
                data: {
                    tree: root,
                    total: uniqueFileCount,
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to load package documents');
        }
    }
    /**
     * UC-PKG-003: Update Package metadata (name, description, type, dueDate, teamMemberIds)
     */
    async updatePackage(req, res) {
        try {
            const { projectId, packageId, name, description, type, dueDate, teamMemberIds, status } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can update packages');
            }
            if (member.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

            const pkg = await PackageRepository.findByPublicIdInProject(normalizedPackageId, normalizedProjectId);
            if (!pkg) return notFound(res, 'Package not found');
            if (pkg.status === 'Archived') return badRequest(res, 'Cannot update an archived package');

            const updateFields = {};
            if (name !== undefined) {
                const normalizedName = normalizeString(name);
                if (!normalizedName) return badRequest(res, 'Package name cannot be empty');

                const duplicate = await PackageRepository.findAnotherByProjectIdAndName(
                    normalizedProjectId,
                    normalizedName,
                    normalizedPackageId
                );
                if (duplicate) {
                    return badRequest(res, 'A package with this name already exists in the project');
                }

                updateFields.name = normalizedName;
            }

            if (description !== undefined) updateFields.description = normalizeString(description) || '';
            if (type !== undefined) updateFields.packageType = normalizeString(type) || '';
            if (dueDate !== undefined) updateFields.dueDate = parseDueDate(dueDate);
            if (Array.isArray(teamMemberIds)) updateFields.teamMemberIds = teamMemberIds;

            if (status !== undefined) {
                if (String(status).toLowerCase() === 'completed') {
                    return badRequest(res, 'Completed is a derived status and cannot be set manually');
                }
                const validStatuses = ['Draft', 'Active', 'Archived'];
                if (!validStatuses.includes(status)) {
                    return badRequest(res, `Invalid status. Allowed values: ${validStatuses.join(', ')}`);
                }
                const currentStatus = pkg.status;
                if (currentStatus === 'Active' && status === 'Draft') {
                    return badRequest(res, 'Cannot move package backward from Active to Draft');
                }
                if (currentStatus === 'Draft' && status === 'Archived') {
                    return badRequest(res, 'Cannot archive package directly from Draft');
                }
                if (status === 'Archived' && currentStatus === 'Active') {
                    const lifecycle = await evaluateSinglePackageLifecycle(normalizedProjectId, pkg);
                    if (lifecycle.lifecycleStatus !== 'Completed') {
                        return badRequest(res, 'Only completed packages can be archived');
                    }
                }
                if (status !== pkg.status) {
                    updateFields.status = status;
                }
            }

            if (Object.keys(updateFields).length === 0) {
                return res.status(200).json({ success: true, message: 'No changes to apply', data: pkg });
            }

            const updated = await PackageRepository.updateByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId,
                updateFields
            );
            const lifecycle = await evaluateSinglePackageLifecycle(normalizedProjectId, updated);

            const updatedData = {
                publicId: updated.publicId,
                projectId: updated.projectId,
                name: updated.name,
                description: updated.description,
                packageType: updated.packageType,
                status: updated.status,
                lifecycleStatus: lifecycle.lifecycleStatus,
                progress: lifecycle.progress,
                completionCriteria: lifecycle.completionCriteria,
                dueDate: updated.dueDate,
                teamMemberIds: updated.teamMemberIds,
                updatedAt: updated.updatedAt,
            };

            broadcastPackage(normalizedPackageId, 'package:updated', {
                ...updatedData,
                packageId: updated.publicId,
                changes: updatedData,
                actorId: userId,
            });
            broadcastProject(normalizedProjectId, 'package:updated', {
                ...updatedData,
                packageId: updated.publicId,
                changes: updatedData,
                actorId: userId,
            });

            // Notify newly added package members
            if (updateFields.teamMemberIds !== undefined) {
                const oldMembers = new Set(pkg.teamMemberIds || []);
                const newMembers = updateFields.teamMemberIds || [];
                const addedMembers = newMembers.filter(id => !oldMembers.has(id));

                if (addedMembers.length > 0) {
                    const editor = await User.findById(userId).select('fullName').lean();
                    const editorName = editor?.fullName || 'Someone';
                    const packageLink = `/projects/${normalizedProjectId}/packages/${normalizedPackageId}`;

                    const userDocs = await User.find({ publicId: { $in: addedMembers } }).select('_id publicId').lean();
                    const mongoIdMap = new Map(userDocs.map(u => [u.publicId, String(u._id)]));

                    for (const memberPublicId of addedMembers) {
                        const mongoId = mongoIdMap.get(memberPublicId);
                        if (!mongoId) continue;
                        const notification = await NotificationRepository.create({
                            userId: mongoId,
                            type: 'info',
                            title: 'Added to package',
                            message: `${editorName} added you to package "${updated.name}"`,
                            link: packageLink,
                            read: false,
                            refType: 'package',
                            refId: normalizedPackageId,
                        });
                        notifyUser(mongoId, 'notification:new', {
                            id: String(notification._id),
                            type: 'info',
                            title: 'Added to package',
                            message: `${editorName} added you to package "${updated.name}"`,
                            link: packageLink,
                            read: false,
                            createdAt: notification.createdAt.toISOString(),
                        });
                    }
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Package updated',
                data: updatedData,
            });
        } catch (error) {
            if (error && error.code === 11000) {
                return badRequest(res, 'A package with this name already exists in the project');
            }
            return serverError(res, error.message || 'Update package failed');
        }
    }

    /**
     * UC-PKG-002: Archive Package
     * Draft/Active -> Archived
     */
    async archivePackage(req, res) {
        try {
            const { projectId, packageId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can archive packages');
            }
            if (member.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

            const pkg = await PackageRepository.findByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );
            if (!pkg) return notFound(res, 'Package not found');

            if (pkg.status === 'Archived') {
                return badRequest(res, 'Package is already archived');
            }
            if (pkg.status !== 'Draft' && pkg.status !== 'Active') {
                return badRequest(res, 'Only Draft or Active packages can be archived');
            }
            if (pkg.status === 'Draft') {
                return badRequest(res, 'Cannot archive package directly from Draft');
            }
            const lifecycle = await evaluateSinglePackageLifecycle(normalizedProjectId, pkg);
            if (lifecycle.lifecycleStatus !== 'Completed') {
                return badRequest(res, 'Only completed packages can be archived');
            }

            const updated = await PackageRepository.archiveByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );

            // Notify all project members so packages list updates
            broadcastProject(normalizedProjectId, 'package:archived', {
                projectId: normalizedProjectId,
                packageId: updated.publicId,
            });

            return res.status(200).json({
                success: true,
                message: 'Package archived (moved to archive page)',
                data: {
                    publicId: updated.publicId,
                    projectId: updated.projectId,
                    name: updated.name,
                    status: updated.status,
                    archivedAt: updated.archivedAt,
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Archive package failed');
        }
    }

    async createDocumentFolder(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, packageId, folderName, folderType, parentPath } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFolderName = normalizeString(folderName);

            if (!normalizedProjectId || !normalizedFolderName) {
                return badRequest(res, 'projectId and folderName are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can create folders');
            }
            if (member.role === 'viewer') {
                return forbidden(res, 'Viewers do not have folder management permission');
            }

            const targetPackageId = normalizeString(packageId) || null;

            if (targetPackageId) {
                const pkg = await PackageRepository.findByPublicIdInProject(targetPackageId, normalizedProjectId);
                if (!pkg || pkg.status === 'Archived') {
                    return badRequest(res, 'Package not found or is archived');
                }

                if (
                    member.role !== 'admin' &&
                    pkg.creatorId !== userId &&
                    !(pkg.teamMemberIds || []).includes(userId)
                ) {
                    return forbidden(res, 'You can only create folder in packages assigned to you');
                }
            }

            const normalizedType = normalizeFolderType(folderType);
            const normalizedParentPath = normalizeFolderPath(parentPath);
            const safeFolderName = normalizedFolderName.replace(/[\\/:*?"<>|]/g, '-').trim();
            if (!safeFolderName) {
                return badRequest(res, 'folderName is invalid');
            }

            const folderPath = normalizedParentPath ? `${normalizedParentPath}/${safeFolderName}` : safeFolderName;

            const existing = await DocumentFolderRepository.findByProjectAndPath({
                projectId: normalizedProjectId,
                packageId: targetPackageId,
                folderType: normalizedType,
                folderPath,
            });
            if (existing) {
                return badRequest(res, 'Folder already exists in this location');
            }

            const created = await DocumentFolderRepository.createFolder({
                projectId: normalizedProjectId,
                packageId: targetPackageId,
                folderType: normalizedType,
                folderPath,
                createdBy: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: created.packageId,
            });

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId: targetPackageId,
                userId,
                type: 'folder_created',
                targetId: created.publicId,
                targetName: folderPath,
                metadata: {},
            });

            await sendDiscordForDoc(normalizedProjectId, userId, 'folder_created', folderPath, {
                packageName: targetPackageId,
            });

            return res.status(201).json({
                success: true,
                message: 'Folder created',
                data: {
                    publicId: created.publicId,
                    projectId: created.projectId,
                    packageId: created.packageId,
                    folderType: created.folderType,
                    folderPath: created.folderPath,
                    createdAt: created.createdAt,
                },
            });
        } catch (error) {
            if (error && error.code === 11000) {
                return badRequest(res, 'Folder already exists in this location');
            }
            return serverError(res, error.message || 'Create folder failed');
        }
    }

    async uploadPackageDocument(req, res) {
        try {
            assertS3Configured();

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, packageId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId) {
                return badRequest(res, 'projectId is required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can upload documents');
            }
            if (member.role === 'viewer') {
                return forbidden(res, 'Viewers do not have document upload permission');
            }

            const targetPackageId = normalizedPackageId || null;

            if (targetPackageId) {
                const pkg = await PackageRepository.findByPublicIdInProject(targetPackageId, normalizedProjectId);
                if (!pkg) return notFound(res, 'Package not found');

                if (
                    member.role !== 'admin' &&
                    pkg.creatorId !== userId &&
                    !(pkg.teamMemberIds || []).includes(userId)
                ) {
                    return forbidden(res, 'You can only upload documents to packages assigned to you');
                }
            }

            const file = req.file;
            if (!file) return badRequest(res, 'file is required (multipart/form-data)');

            const folderType = normalizeFolderType(req.body?.folderType);
            const folderPath = normalizeFolderPath(req.body?.folderPath);
            const ext = path.extname(file.originalname || '').toLowerCase();
            const isIfcFile = ext === IFC_EXTENSION;

            // Read file buffer early — needed for duplicate detection and IFC metadata
            const fileBuffer = fs.readFileSync(file.path);

            // ── Duplicate Detection ──────────────────────────────────────────────
            const duplicate = await findDuplicateDocument({
                projectId: normalizedProjectId,
                packageId: targetPackageId,
                folderPath,
                fileName: file.originalname,
                fileSize: file.size,
                fileBuffer,
                isIfc: isIfcFile,
            });

            let versionGroupId;
            let versionNumber;
            let isNewVersion = false;
            const uuidv7 = generateUUIDv7();

            if (duplicate) {
                // Upload is a new version of an existing file
                versionGroupId = duplicate.versionGroupId;
                versionNumber = nextVersion(duplicate.versionNumber);
                isNewVersion = true;
            } else {
                versionGroupId = crypto.randomUUID();
                versionNumber = 1;
            }

            // Build S3 key — include version number in the key for versioned files
            const versionedName = isNewVersion
                ? `${path.basename(file.originalname, ext)}_v${versionNumber}${ext}`
                : file.originalname;

            const s3Key = buildStorageKey({
                projectId: normalizedProjectId,
                packageId: targetPackageId,
                packageName: null,
                folderType,
                folderPath,
                originalName: versionedName,
            });

            if (file.size <= SYNC_UPLOAD_MAX_BYTES) {
                // ── Sync Upload (≤20MB) — store on Supabase ────────────────────────
                const supaFilePath = buildProjectFilePath({
                    projectId: normalizedProjectId,
                    versionGroupId,
                    originalName: file.originalname,
                    uuidv7,
                });

                let supaFileUrl = '';
                try {
                    const supaResult = await uploadProjectFileBuffer(fileBuffer, supaFilePath);
                    supaFileUrl = supaResult.publicUrl || '';
                } catch (supaErr) {
                    console.warn('[PackageController] Supabase file upload failed, continuing without Supabase:', supaErr.message);
                }

                const versionLabel = normalizeString(req.body?.versionLabel);
                const versionDescription = normalizeString(req.body?.versionDescription) || '';

                if (!versionLabel) {
                    fs.unlink(file.path, () => {});
                    return badRequest(res, 'versionLabel is required (e.g. v1.0.0)');
                }

                const ifcMeta = isIfcFile ? extractIfcMetadata(fileBuffer) : {};
                const document = await DocumentRepository.createDocument({
                    projectId: normalizedProjectId,
                    packageId: targetPackageId,
                    folderType,
                    folderPath,
                    originalName: file.originalname,
                    storedName: path.basename(supaFilePath),
                    mimeType: file.mimetype || '',
                    size: file.size || 0,
                    extension: ext.replace('.', ''),
                    storageProvider: 'supabase',
                    storageEndpoint: SUPABASE_URL || '',
                    s3Bucket: S3_BUCKET,
                    s3Key,
                    s3Url: supaFileUrl || buildS3Url(s3Key),
                    supabaseFileKey: supaFilePath,
                    supabaseFileUrl: supaFileUrl,
                    uploadedBy: userId,
                    versionGroupId,
                    versionNumber,
                    uuidv7,
                    versionLabel,
                    versionDescription,
                    _ifcMeta: ifcMeta,
                    conversionStatus: isIfcFile ? 'PENDING' : 'NOT_SUPPORTED',
                    conversionAttempts: 0,
                    conversionError: '',
                    approvalStatus: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                const newApproval = await UploadApprovalRepository.create({
                    projectId: normalizedProjectId,
                    documentId: document.publicId,
                    packageId: targetPackageId,
                    jobId: null,
                    uploaderId: userId,
                    originalName: file.originalname,
                    mimeType: file.mimetype || '',
                    size: file.size || 0,
                    folderType,
                    folderPath,
                    versionGroupId,
                    versionNumber,
                    versionLabel,
                    versionDescription,
                    isNewVersion,
                    status: 'pending',
                    fileUrl: supaFileUrl || buildS3Url(s3Key),
                    s3Key,
                    supabaseFileKey: supaFilePath,
                });

                // Trigger IFC-to-XKT conversion immediately on upload (preview available before approval)
                if (isIfcFile) {
                    try {
                        await publishIfcConversionJob({
                            projectId: normalizedProjectId,
                            documentId: document.publicId,
                            versionId: document.publicId,
                            ifcS3Bucket: S3_BUCKET,
                            ifcS3Key: s3Key,
                            requestedBy: userId,
                        });
                    } catch (convErr) {
                        console.error('[PackageController] IFC conversion job publish failed:', convErr.message);
                    }
                }

                broadcastProject(normalizedProjectId, 'approval:new', {
                    projectId: normalizedProjectId,
                    approvalId: newApproval.publicId,
                });

                if (targetPackageId) {
                    await PackageRepository.addDocumentIdToPackage(
                        targetPackageId,
                        normalizedProjectId,
                        document.publicId
                    );
                }

                fs.unlink(file.path, () => {});

                return res.status(202).json({
                    success: true,
                    mode: 'sync',
                    message: `Upload submitted for approval: ${versionLabel}`,
                    data: {
                        documentPublicId: document.publicId,
                        folderType: document.folderType,
                        folderPath: document.folderPath,
                        s3Key: document.s3Key,
                        s3Url: document.s3Url,
                        isNewVersion,
                        versionNumber,
                        versionGroupId,
                        versionLabel,
                        approvalStatus: 'pending',
                    },
                });
            }

            // ── Queued Upload (>20MB) — store on Supabase ──────────────────────
            const supaFilePath = buildProjectFilePath({
                projectId: normalizedProjectId,
                versionGroupId,
                originalName: file.originalname,
                uuidv7,
            });

            const versionLabel = normalizeString(req.body?.versionLabel);
                const versionDescription = normalizeString(req.body?.versionDescription) || '';

                if (!versionLabel) {
                    fs.unlink(file.path, () => {});
                    return badRequest(res, 'versionLabel is required (e.g. v1.0.0)');
                }

                const uploadJob = await UploadJobRepository.createJob({
                    projectId: normalizedProjectId,
                    packageId: targetPackageId,
                    uploaderId: userId,
                    fileOriginalName: file.originalname,
                    mimeType: file.mimetype || '',
                    size: file.size || 0,
                    folderType,
                    folderPath,
                    tempFilePath: file.path,
                    s3Bucket: S3_BUCKET,
                    s3Key,
                    storageProvider: 'supabase',
                    storageEndpoint: SUPABASE_URL || '',
                    status: 'queued',
                    progress: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    versionGroupId,
                    versionNumber,
                    versionLabel,
                    versionDescription,
                    isNewVersion,
                    supaFilePath,
                    uuidv7,
                });

            await publishPackageUpload(uploadJob.publicId);

            return res.status(202).json({
                    success: true,
                    mode: 'queue',
                    message: `Upload queued for approval: ${versionLabel}`,
                    data: {
                        jobId: uploadJob.publicId,
                        status: uploadJob.status,
                        progress: uploadJob.progress,
                        versionLabel,
                        approvalStatus: 'pending',
                    },
                });
        } catch (error) {
            return serverError(res, error.message || 'Upload failed');
        }
    }

    async getUploadJobStatus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const jobId = normalizeString(req.params?.jobId);
            if (!jobId) return badRequest(res, 'jobId is required');

            const job = await UploadJobRepository.findByPublicId(jobId);
            if (!job) return notFound(res, 'Upload job not found');

            if (job.uploaderId !== userId) {
                const member = await ProjectMemberRepository.findMember(job.projectId, userId);
                if (!member || member.status !== 'accepted') {
                    return forbidden(res, 'You do not have permission to view this upload job');
                }
            }

            return res.status(200).json({ success: true, data: responseData });
        } catch (error) {
            return serverError(res, error.message || 'Failed to get upload job status');
        }
    }

    async renameDocumentFile(req, res) {
        try {
            const { projectId, fileId, newName } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);
            const normalizedName = normalizeString(newName);

            if (!normalizedProjectId || !normalizedFileId || !normalizedName) {
                return badRequest(res, 'projectId, fileId, newName are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can rename files');
            }

            const updated = await DocumentRepository.updateNameByPublicId(normalizedFileId, normalizedName);
            if (!updated || updated.projectId !== normalizedProjectId) {
                return notFound(res, 'File not found');
            }

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId: updated.packageId,
                userId,
                type: 'file_renamed',
                targetId: normalizedFileId,
                targetName: normalizedName,
                metadata: { oldName: updated.originalName },
            });

            await sendDiscordForDoc(normalizedProjectId, userId, 'file_renamed', normalizedName, {
                oldName: updated.originalName,
            });

            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: updated.packageId || null,
            });

            return res.status(200).json({ success: true, data: updated });
        } catch (error) {
            return serverError(res, error.message || 'Rename file failed');
        }
    }

    async deleteDocumentFile(req, res) {
        try {
            const { projectId, fileId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);

            if (!normalizedProjectId || !normalizedFileId) {
                return badRequest(res, 'projectId and fileId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can delete files');
            }

            const doc = await DocumentRepository.findByPublicId(normalizedFileId);
            if (!doc || doc.projectId !== normalizedProjectId) {
                return notFound(res, 'File not found');
            }

            const deletedName = doc.originalName;
            const deletedPackageId = doc.packageId;

            await DocumentRepository.deleteByPublicId(normalizedFileId);

            const UploadApprovalRepository = require('../repositories/UploadApprovalRepository');
            const approval = await UploadApprovalRepository.findByDocumentId(normalizedFileId);
            await UploadApprovalRepository.deleteByDocumentId(normalizedFileId);

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId: deletedPackageId,
                userId,
                type: 'file_deleted',
                targetId: normalizedFileId,
                targetName: deletedName,
                metadata: {},
            });

            await sendDiscordForDoc(normalizedProjectId, userId, 'file_deleted', deletedName, {});

            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: deletedPackageId || null,
            });
            broadcastProject(normalizedProjectId, 'approval:deleted', {
                projectId: normalizedProjectId,
                approvalId: approval?.publicId || normalizedFileId,
                documentId: normalizedFileId,
                status: approval?.status || null,
            });

            return res.status(200).json({ success: true, message: 'File deleted' });
        } catch (error) {
            return serverError(res, error.message || 'Delete file failed');
        }
    }

    async renameDocumentFolder(req, res) {
        try {
            const { projectId, folderId, newName } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFolderId = normalizeString(folderId);
            const normalizedName = normalizeString(newName);

            if (!normalizedProjectId || !normalizedFolderId || !normalizedName) {
                return badRequest(res, 'projectId, folderId, newName are required');
            }

            if (normalizedName.length > 255) {
                return badRequest(res, 'Folder name must not exceed 255 characters');
            }

            const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
            if (invalidChars.test(normalizedName)) {
                return badRequest(res, 'Folder name contains invalid characters');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can rename folders');
            }

            let folder;
            let folderPath;

            if (normalizedFolderId.startsWith('root/pkg/') || normalizedFolderId === 'root') {
                return badRequest(res, 'Root or package folder cannot be renamed');
            }

            if (normalizedFolderId.startsWith('root/')) {
                folderPath = normalizedFolderId.slice(5);
            } else {
                folderPath = normalizedFolderId;
            }

            folder = await DocumentFolderRepository.findOneByPath({
                projectId: normalizedProjectId,
                packageId: null,
                folderPath,
            });

            if (!folder) {
                return notFound(res, 'Folder not found');
            }

            const parts = String(folder.folderPath || '').split('/').filter(Boolean);
            if (!parts.length) return badRequest(res, 'Root folder cannot be renamed');

            const parentPath = parts.slice(0, -1).join('/');

            const siblings = await DocumentFolderRepository.findSiblings({
                projectId: normalizedProjectId,
                packageId: folder.packageId || null,
                parentPath: parentPath || '',
            });

            const duplicate = siblings.find(s => s.publicId !== folder.publicId && s.folderPath === parentPath + '/' + normalizedName);
            if (duplicate) {
                return conflict(res, 'A folder with this name already exists in this location');
            }

            const newPath = parts.slice(0, -1).concat(normalizedName).join('/');
            const oldPath = folder.folderPath;

            await DocumentFolderRepository.renamePathPrefix({
                projectId: folder.projectId,
                packageId: folder.packageId || null,
                oldPrefix: oldPath,
                newPrefix: newPath,
            });

            await DocumentRepository.renameFolderPath({
                projectId: folder.projectId,
                packageId: folder.packageId || null,
                oldPrefix: oldPath,
                newPrefix: newPath,
            });

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId: folder.packageId || null,
                userId,
                type: 'folder_renamed',
                targetId: folder.publicId,
                targetName: newPath,
                metadata: { oldPath, newPath },
            });

            await sendDiscordForDoc(normalizedProjectId, userId, 'folder_renamed', newPath, {
                oldPath,
                newPath,
            });

            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: folder.packageId || null,
            });

            return res.status(200).json({ success: true, message: 'Folder renamed' });
        } catch (error) {
            return serverError(res, error.message || 'Rename folder failed');
        }
    }

    async deleteDocumentFolder(req, res) {
        try {
            const { projectId, folderId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFolderId = normalizeString(folderId);

            if (!normalizedProjectId || !normalizedFolderId) {
                return badRequest(res, 'projectId and folderId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can delete folders');
            }

            // folderId is a tree node path (e.g. "root/SS", "root/pkg/<uuid>/sub")
            // Parse to derive packageId + folderPath for DB query
            const pkgMarker = '/pkg/';
            const pkgIndex = normalizedFolderId.indexOf(pkgMarker);
            let packageId = null;
            let folderPath = '';

            if (pkgIndex !== -1) {
                const pathAfterPkg = normalizedFolderId.slice(pkgIndex + pkgMarker.length);
                const slashIdx = pathAfterPkg.indexOf('/');
                if (slashIdx === -1) {
                    packageId = pathAfterPkg;
                    folderPath = '';
                } else {
                    packageId = pathAfterPkg.slice(0, slashIdx);
                    folderPath = pathAfterPkg.slice(slashIdx + 1);
                }
            } else {
                const rootPrefix = 'root/';
                folderPath = normalizedFolderId.startsWith(rootPrefix)
                    ? normalizedFolderId.slice(rootPrefix.length)
                    : normalizedFolderId;
            }

            if (packageId && folderPath === '') {
                return badRequest(res, 'Folder này thuộc về một package và không thể xóa. Hãy xóa package để xóa folder tự động.');
            }

            const existing = await DocumentFolderRepository.findOneByPath({
                projectId: normalizedProjectId,
                packageId,
                folderPath,
            });
            if (!existing) {
                return notFound(res, 'Folder not found');
            }

            const deletedPath = existing.folderPath;

            await DocumentFolderRepository.deleteByPathPrefix({
                projectId: normalizedProjectId,
                packageId,
                pathPrefix: folderPath,
            });

            await DocumentRepository.deleteByFolderPathPrefix({
                projectId: normalizedProjectId,
                packageId,
                pathPrefix: folderPath,
            });

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId,
                userId,
                type: 'folder_deleted',
                targetId: existing.publicId,
                targetName: deletedPath,
                metadata: {},
            });

            await sendDiscordForDoc(normalizedProjectId, userId, 'folder_deleted', deletedPath, {});

            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: packageId || null,
            });

            return res.status(200).json({ success: true, message: 'Folder deleted' });
        } catch (error) {
            return serverError(res, error.message || 'Delete folder failed');
        }
    }

    async getIfcViewStatus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, fileId, versionId, fileName } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);
            const normalizedVersionId = normalizeString(versionId) || normalizedFileId;
            const normalizedFileName = normalizeString(fileName);

            if (!normalizedProjectId || (!normalizedFileId && !normalizedFileName)) {
                return badRequest(res, 'projectId and fileId or fileName are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view documents');
            }

            // Try lookup by fileId first, fallback to filename
            let doc = null;
            if (normalizedFileId) {
                doc = await DocumentRepository.findByPublicId(normalizedFileId);
            }
            if (!doc && normalizedFileName) {
                doc = await DocumentRepository.findByNameInProject(normalizedProjectId, normalizedFileName);
            }
            if (!doc || doc.projectId !== normalizedProjectId) {
                return notFound(res, 'File version not found');
            }

            const status = doc.conversionStatus || 'NOT_SUPPORTED';
            const isViewable = status === 'READY' && Boolean(doc.xktKey);

            return res.status(200).json({
                success: true,
                data: {
                    fileId: normalizedFileId,
                    versionId: doc.publicId,
                    status,
                    isViewable,
                    versionNumber: doc.versionNumber || 1,
                    viewerUrl: isViewable
                        ? `/project/${normalizedProjectId}/${normalizedFileId}/${doc.publicId}`
                        : '',
                    message:
                        status === 'READY'
                            ? 'Model is ready'
                            : status === 'FAILED'
                            ? doc.conversionError || 'Conversion failed'
                            : status === 'NOT_SUPPORTED'
                            ? 'This file type is not supported for viewer'
                            : 'Model is processing',
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to get view status');
        }
    }

    async retryIfcConversion(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, fileId, versionId, fileName } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);
            const normalizedVersionId = normalizeString(versionId) || normalizedFileId;
            const normalizedFileName = normalizeString(fileName);

            if (!normalizedProjectId || (!normalizedFileId && !normalizedFileName)) {
                return badRequest(res, 'projectId and fileId or fileName are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can retry conversion');
            }

            // Try lookup by fileId first, fallback to filename
            let doc = null;
            if (normalizedFileId) {
                doc = await DocumentRepository.findByPublicId(normalizedVersionId);
            }
            if (!doc && normalizedFileName) {
                doc = await DocumentRepository.findByNameInProject(normalizedProjectId, normalizedFileName);
            }
            if (!doc || doc.projectId !== normalizedProjectId) {
                return notFound(res, 'File version not found');
            }

            const isIfcFile = path.extname(doc.originalName || '').toLowerCase() === IFC_EXTENSION;
            if (!isIfcFile) {
                return badRequest(res, 'Only IFC files can be queued for viewer conversion');
            }

            await DocumentRepository.updateConversionStateByPublicId(doc.publicId, {
                conversionStatus: 'PENDING',
                conversionError: '',
            });

            await publishIfcConversionJob({
                projectId: normalizedProjectId,
                documentId: normalizedFileId,
                versionId: doc.publicId,
                ifcS3Bucket: doc.s3Bucket,
                ifcS3Key: doc.s3Key,
                requestedBy: userId,
            });

            broadcastProject(normalizedProjectId, 'document:conversion-updated', {
                projectId: normalizedProjectId,
                packageId: doc.packageId || null,
                documentId: normalizedFileId,
                versionId: doc.publicId,
                status: 'PENDING',
                conversionStatus: 'PENDING',
            });

            return res.status(202).json({
                success: true,
                message: 'IFC conversion queued',
                data: {
                    fileId: normalizedFileId,
                    versionId: doc.publicId,
                    status: 'PENDING',
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to retry conversion');
        }
    }

    async getViewerModel(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, fileId, versionId } = req.params || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);
            const normalizedVersionId = normalizeString(versionId);

            if (!normalizedProjectId || !normalizedFileId || !normalizedVersionId) {
                return badRequest(res, 'projectId, fileId, versionId are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can access viewer model');
            }

            let doc = await DocumentRepository.findByPublicId(normalizedVersionId);
            if (!doc || doc.projectId !== normalizedProjectId) {
                doc = await DocumentRepository.findByPublicId(normalizedFileId);
            }
            if (!doc) {
                console.error(`[getViewerModel] Document not found by versionId="${normalizedVersionId}" nor fileId="${normalizedFileId}"`);
                return notFound(res, 'File version not found');
            }
            if (doc.projectId !== normalizedProjectId) {
                console.error(`[getViewerModel] Document projectId mismatch: doc.projectId="${doc.projectId}" !== normalizedProjectId="${normalizedProjectId}"`);
                return notFound(res, 'File version not found');
            }

            if (doc.conversionStatus !== 'READY' || !doc.xktKey) {
                return badRequest(res, 'Model is not ready for viewing');
            }

            const signedUrl = await createSignedXktUrl(doc.xktKey, 3600);
            return res.status(200).json({
                success: true,
                data: {
                    projectId: normalizedProjectId,
                    fileId: normalizedFileId,
                    versionId: doc.publicId,
                    versionNumber: doc.versionNumber || 1,
                    modelUrl: signedUrl,
                    originalName: doc.originalName,
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to get viewer model URL');
        }
    }

    /**
     * Delete package only when status === Archived
     */
    async deletePackage(req, res) {
        try {
            const { projectId, packageId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can delete packages');
            }
            if (member.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

            const pkg = await PackageRepository.findByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );
            if (!pkg) return notFound(res, 'Package not found');

            if (pkg.status !== 'Archived') {
                return badRequest(
                    res,
                    'Only archived packages can be deleted. Archive the package first.'
                );
            }

            await PackageRepository.deleteByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );

            await DocumentFolderRepository.deleteByPackageId(normalizedPackageId);
            await DocumentRepository.deleteByPackageId(normalizedPackageId);

            broadcastProject(normalizedProjectId, 'package:deleted', {
                projectId: normalizedProjectId,
                packageId: normalizedPackageId,
            });

            return res.status(200).json({
                success: true,
                message: 'Package deleted permanently',
            });
        } catch (error) {
            return serverError(res, error.message || 'Delete package failed');
        }
    }
}

module.exports = new PackageController();
