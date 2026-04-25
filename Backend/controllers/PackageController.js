const { errorResponse } = require('../utils/response');
const { normalizeString } = require('../utils/sanitize');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const ProjectRepository = require('../repositories/ProjectRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const DocumentRepository = require('../repositories/DocumentRepository');
const DocumentFolderRepository = require('../repositories/DocumentFolderRepository');
const UploadJobRepository = require('../repositories/UploadJobRepository');
const { publishPackageUpload } = require('../queues/packageUploadQueue');
const { publishIfcConversionJob } = require('../queues/ifcConversionQueue');
const { createSignedXktUrl, uploadIfcBuffer, buildSupabaseIfcPath } = require('../services/supabaseStorageService');
const { s3Client, S3_BUCKET, S3_ENDPOINT, STORAGE_PROVIDER, buildS3Url, assertS3Configured } = require('../config/s3');
const { broadcastProject } = require('../services/socketService');
const ActivityService = require('../services/activityService');
const DiscordService = require('../services/discordService');
const User = require('../models/User');
const Task = require('../models/Task');
const Document = require('../models/Document');
const {
    DONE_TASK_STATUSES,
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

async function buildPackageLifecycleMap(projectId, packageIds = [], packageRows = []) {
    const normalizedIds = [...new Set((packageIds || []).filter(Boolean))];
    if (normalizedIds.length === 0) return new Map();

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
                                { $in: [{ $toLower: '$status' }, [...DONE_TASK_STATUSES]] },
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
    const [tasks, docs] = await Promise.all([
        Task.find({ projectId, packageId }, { status: 1 }).lean(),
        DocumentRepository.listByProjectAndPackage(projectId, packageId),
    ]);
    const doneTaskTotal = tasks.reduce(
        (acc, task) => acc + (DONE_TASK_STATUSES.has(normalizeTaskStatus(task?.status)) ? 1 : 0),
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

function buildDocumentsTree({ docs, folders, rootName = 'All Files', rootId = 'root' }) {
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

    for (const doc of docs || []) {
        const parentKey = resolveFolderChain(doc.folderPath || '');
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
            versionId: doc.publicId,
            conversionStatus: doc.conversionStatus || 'NOT_SUPPORTED',
            conversionError: doc.conversionError || '',
            isIfc: path.extname(doc.originalName || '').toLowerCase() === IFC_EXTENSION,
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

            return res.status(201).json({
                success: true,
                message: 'Package created',
                data: {
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
                },
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
                    (doc) => !doc.packageId || visiblePackageIds.has(doc.packageId)
                );
                filteredFolders = (emptyFolders || []).filter(
                    (folder) => !folder.packageId || visiblePackageIds.has(folder.packageId)
                );
            } else {
                filteredDocs = (docs || []).filter(isProjectRootScope);
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

            for (const doc of filteredDocs) {
                const parentKey = resolveFolderChain(doc.packageId || null, doc.folderPath || '');

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
                    versionId: doc.publicId,
                    conversionStatus: doc.conversionStatus || 'NOT_SUPPORTED',
                    conversionError: doc.conversionError || '',
                    isIfc: path.extname(doc.originalName || '').toLowerCase() === IFC_EXTENSION,
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

            const rootId = `root/pkg/${normalizedPackageId}`;
            const root = buildDocumentsTree({
                docs,
                folders,
                rootId,
                rootName: access.pkg?.name || 'Package Files',
            });
            root.icon = 'package';

            return res.status(200).json({
                success: true,
                data: {
                    tree: root,
                    total: docs.length,
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

            return res.status(200).json({
                success: true,
                message: 'Package updated',
                data: {
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
                },
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
            const s3Key = buildStorageKey({
                projectId: normalizedProjectId,
                packageId: targetPackageId,
                packageName: null,
                folderType,
                folderPath,
                originalName: file.originalname,
            });

            if (file.size <= SYNC_UPLOAD_MAX_BYTES) {
                const body = fs.readFileSync(file.path);
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: S3_BUCKET,
                        Key: s3Key,
                        Body: body,
                        ContentType: file.mimetype || undefined,
                    })
                );

                const ext = path.extname(file.originalname || '').toLowerCase();
                const versionGroupId = crypto.randomUUID();
                const isIfcFile = ext === IFC_EXTENSION;

                const document = await DocumentRepository.createDocument({
                    projectId: normalizedProjectId,
                    packageId: targetPackageId,
                    folderType,
                    folderPath,
                    originalName: file.originalname,
                    storedName: path.basename(s3Key),
                    mimeType: file.mimetype || '',
                    size: file.size || 0,
                    extension: path.extname(file.originalname || '').replace('.', '').toLowerCase(),
                    storageProvider: getStorageProvider(),
                    storageEndpoint: S3_ENDPOINT || '',
                    s3Bucket: S3_BUCKET,
                    s3Key,
                    s3Url: buildS3Url(s3Key),
                    uploadedBy: userId,
                    versionGroupId,
                    versionNumber: 1,
                    conversionStatus: isIfcFile ? 'PENDING' : 'NOT_SUPPORTED',
                    conversionAttempts: 0,
                    conversionError: '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                if (targetPackageId) {
                    await PackageRepository.addDocumentIdToPackage(
                        targetPackageId,
                        normalizedProjectId,
                        document.publicId
                    );
                }

                // Log activity + Discord notification
                await ActivityService.log({
                    projectId: normalizedProjectId,
                    packageId: targetPackageId,
                    userId,
                    type: 'file_uploaded',
                    targetId: document.publicId,
                    targetName: file.originalname,
                    metadata: { size: file.size, mimeType: file.mimetype },
                });

                await sendDiscordForDoc(normalizedProjectId, userId, 'file_uploaded', file.originalname, {
                    size: file.size,
                    mimeType: file.mimetype,
                });

                if (isIfcFile) {
                    // Upload IFC lên Supabase để clash detection dùng (không cần MinIO)
                    try {
                        const ifcPath = buildSupabaseIfcPath({
                            projectId: normalizedProjectId,
                            documentId: document.publicId,
                            originalName: file.originalname,
                        });
                        await uploadIfcBuffer(body, ifcPath);
                        await DocumentRepository.updateConversionStateByPublicId(document.publicId, { supabaseIfcKey: ifcPath });
                    } catch (supaErr) {
                        console.warn('[PackageController] Supabase IFC upload skipped:', supaErr.message);
                    }

                    await publishIfcConversionJob({
                        projectId: normalizedProjectId,
                        documentId: document.publicId,
                        versionId: document.publicId,
                        ifcS3Bucket: document.s3Bucket,
                        ifcS3Key: document.s3Key,
                    });
                }

                fs.unlink(file.path, () => {});

                return res.status(201).json({
                    success: true,
                    mode: 'sync',
                    message: 'Upload completed',
                    data: {
                        documentPublicId: document.publicId,
                        folderType: document.folderType,
                        folderPath: document.folderPath,
                        s3Key: document.s3Key,
                        s3Url: document.s3Url,
                    },
                });
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
                storageProvider: getStorageProvider(),
                storageEndpoint: S3_ENDPOINT || '',
                status: 'queued',
                progress: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await publishPackageUpload(uploadJob.publicId);

            return res.status(202).json({
                success: true,
                mode: 'queue',
                message: 'Upload queued for background processing',
                data: {
                    jobId: uploadJob.publicId,
                    status: uploadJob.status,
                    progress: uploadJob.progress,
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

            return res.status(200).json({ success: true, message: 'Folder deleted' });
        } catch (error) {
            return serverError(res, error.message || 'Delete folder failed');
        }
    }

    async getIfcViewStatus(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, fileId, versionId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);
            const normalizedVersionId = normalizeString(versionId) || normalizedFileId;

            if (!normalizedProjectId || !normalizedFileId) {
                return badRequest(res, 'projectId and fileId are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view documents');
            }

            const doc = await DocumentRepository.findByPublicId(normalizedVersionId);
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

            const { projectId, fileId, versionId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFileId = normalizeString(fileId);
            const normalizedVersionId = normalizeString(versionId) || normalizedFileId;

            if (!normalizedProjectId || !normalizedFileId) {
                return badRequest(res, 'projectId and fileId are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can retry conversion');
            }

            const doc = await DocumentRepository.findByPublicId(normalizedVersionId);
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

            const doc = await DocumentRepository.findByPublicId(normalizedVersionId);
            if (!doc || doc.projectId !== normalizedProjectId) {
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