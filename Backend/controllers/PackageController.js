const { errorResponse } = require('../utils/response');
const { normalizeString } = require('../utils/sanitize');

const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const ProjectRepository = require('../repositories/ProjectRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const DocumentRepository = require('../repositories/DocumentRepository');
const DocumentFolderRepository = require('../repositories/DocumentFolderRepository');
const UploadJobRepository = require('../repositories/UploadJobRepository');
const { publishPackageUpload } = require('../queues/packageUploadQueue');
const { s3Client, S3_BUCKET, S3_ENDPOINT, STORAGE_PROVIDER, buildS3Url, assertS3Configured } = require('../config/s3');
const { broadcastProject } = require('../services/socketService');

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
        .join('/');
}

function getStorageProvider() {
    return normalizeString(STORAGE_PROVIDER) || 's3';
}

function buildStorageKey({ projectId, packageId, folderType, folderPath, originalName, packageName }) {
    const ext = path.extname(originalName || '').toLowerCase();
    const base = path.basename(originalName || 'file', ext).replace(/[^a-zA-Z0-9-_]/g, '-');
    const safeBase = base || 'file';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const normalizedPath = normalizeFolderPath(folderPath);
    const prefix = normalizedPath ? `${normalizedPath}/` : '';

    if (!packageId) {
        return `projects/${projectId}/root/${folderType}/${prefix}${safeBase}-${unique}${ext}`;
    }

    const safePackageName = (normalizeString(packageName) || 'package')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase();

    return `projects/${projectId}/${safePackageName}-${packageId}/${folderType}/${prefix}${safeBase}-${unique}${ext}`;
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

            const packageDoc = await PackageRepository.create({
                projectId: normalizedProjectId,
                name: normalizedName,
                description: description != null ? normalizeString(description) : '',
                packageType: type != null ? normalizeString(type) : '',
                status: 'Draft',
                dueDate: parseDueDate(dueDate),
                creatorId: userId,
                teamMemberIds: normalizedTeamMemberIds,
                documentIds: [],
                taskIds: [],
                archivedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create a package folder at project root in documents tree
            await DocumentFolderRepository.createFolder({
                projectId: normalizedProjectId,
                packageId: packageDoc.publicId,
                folderType: 'files',
                folderPath: '',
                createdBy: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            broadcastProject(normalizedProjectId, 'documents:refresh', {
                projectId: normalizedProjectId,
                packageId: packageDoc.publicId,
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

            return res.status(200).json({
                success: true,
                listType: scope,
                data: packages,
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to load packages');
        }
    }

    async listProjectDocuments(req, res) {
        try {
            const { projectId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            if (!normalizedProjectId) return badRequest(res, 'projectId is required');

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view documents');
            }

            const visiblePackages = member.role === 'admin'
                ? await PackageRepository.listByProjectIdSorted(normalizedProjectId, 'all')
                : await PackageRepository.listByProjectAndMember(normalizedProjectId, userId, 'all');

            const visiblePackageIds = new Set((visiblePackages || []).map((pkg) => pkg.publicId));

            const [docs, emptyFolders] = await Promise.all([
                DocumentRepository.listByProject(normalizedProjectId),
                DocumentFolderRepository.listByProject(normalizedProjectId),
            ]);

            const filteredDocs = (docs || []).filter(
                (doc) => !doc.packageId || visiblePackageIds.has(doc.packageId)
            );
            const filteredFolders = (emptyFolders || []).filter(
                (folder) => !folder.packageId || visiblePackageIds.has(folder.packageId)
            );

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

            for (const pkg of visiblePackages) {
                resolveScopeNode(pkg.publicId);
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
    /**
     * UC-PKG-003: Update Package metadata (name, description, type, dueDate, teamMemberIds)
     */
    async updatePackage(req, res) {
        try {
            const { projectId, packageId, name, description, type, dueDate, teamMemberIds } = req.body || {};
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

            const updated = await PackageRepository.updateByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId,
                updateFields
            );

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

            const updated = await PackageRepository.archiveByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );

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

            return res.status(200).json({
                success: true,
                data: {
                    jobId: job.publicId,
                    status: job.status,
                    progress: job.progress,
                    errorMessage: job.errorMessage,
                    documentPublicId: job.documentPublicId,
                    folderType: job.folderType,
                    folderPath: job.folderPath,
                    size: job.size,
                    createdAt: job.createdAt,
                    startedAt: job.startedAt,
                    finishedAt: job.finishedAt,
                },
            });
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

            await DocumentRepository.deleteByPublicId(normalizedFileId);

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

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can rename folders');
            }

            const folder = await DocumentFolderRepository.findByPublicId(normalizedFolderId);
            if (!folder || folder.projectId !== normalizedProjectId) {
                return notFound(res, 'Folder not found');
            }

            const parts = String(folder.folderPath || '').split('/').filter(Boolean);
            if (!parts.length) return badRequest(res, 'Root folder cannot be renamed');

            parts[parts.length - 1] = normalizedName;
            const newPath = parts.join('/');
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

            const folder = await DocumentFolderRepository.findByPublicId(normalizedFolderId);
            if (!folder || folder.projectId !== normalizedProjectId) {
                return notFound(res, 'Folder not found');
            }

            await DocumentFolderRepository.deleteByPathPrefix({
                projectId: folder.projectId,
                packageId: folder.packageId || null,
                pathPrefix: folder.folderPath,
            });

            await DocumentRepository.deleteByFolderPathPrefix({
                projectId: folder.projectId,
                packageId: folder.packageId || null,
                pathPrefix: folder.folderPath,
            });

            return res.status(200).json({ success: true, message: 'Folder deleted' });
        } catch (error) {
            return serverError(res, error.message || 'Delete folder failed');
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