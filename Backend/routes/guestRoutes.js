const express = require('express');
const crypto = require('crypto');
const path = require('path');
const ShareLink = require('../models/ShareLink');
const Project = require('../models/Project');
const Package = require('../models/Package');
const Task = require('../models/Task');
const User = require('../models/User');
const ProjectMember = require('../models/ProjectMember');
const Document = require('../models/Document');
const DocumentRepository = require('../repositories/DocumentRepository');
const DocumentFolderRepository = require('../repositories/DocumentFolderRepository');

const router = express.Router();

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function serializeShareLink(link) {
    return {
        projectId: link.projectId,
        packageIds: Array.isArray(link.packageIds) ? link.packageIds : [],
        teamIds: Array.isArray(link.teamIds) ? link.teamIds : [],
        shareType: link.shareType,
        shareUrl: link.shareUrl,
        label: link.label,
        allowedRoles: Array.isArray(link.allowedRoles) ? link.allowedRoles : ['guest'],
        allowedPages: Array.isArray(link.allowedPages) ? link.allowedPages : ['overview', 'documents'],
        allowedTeamIds: Array.isArray(link.allowedTeamIds) ? link.allowedTeamIds : [],
        role: 'guest',
    };
}

function hasPackageAccess(link, packageId) {
    if (!packageId) return true;
    if (link.shareType !== 'packages') return true;
    const packageIds = Array.isArray(link.packageIds) ? link.packageIds.map(String) : [];
    return packageIds.includes(String(packageId));
}

function hasPageAccess(link, page) {
    if (!page) return true;
    const pages = Array.isArray(link.allowedPages) ? link.allowedPages.map(String) : [];
    return pages.length === 0 || pages.includes(page);
}

async function resolveGuestLink({ token, projectId, packageId = '', page = '' }) {
    const rawToken = typeof token === 'string' ? token.trim() : '';
    if (!rawToken) return { status: 400, body: { success: false, message: 'Missing token' } };

    const tokenHash = hashToken(rawToken);
    const query = { tokenHash, isActive: true };
    if (projectId) query.projectId = projectId;
    const link = await ShareLink.findOne(query);

    if (!link) return { status: 404, body: { success: false, message: 'Share link not found or has been revoked' } };
    if (new Date() > link.expiresAt) return { status: 410, body: { success: false, message: 'Share link has expired' } };
    if (!hasPackageAccess(link, packageId)) {
        return { status: 403, body: { success: false, message: 'You do not have access to this package' } };
    }
    if (!hasPageAccess(link, page)) {
        return { status: 403, body: { success: false, message: `This share link does not allow access to ${page}` } };
    }

    return { link };
}

router.get('/share/resolve/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const resolved = await resolveGuestLink({ token });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        return res.status(200).json({
            success: true,
            data: serializeShareLink(resolved.link),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to resolve share link' });
    }
});

router.get('/project/:projectId', async (req, res) => {
    try {
        const { token } = req.query;
        const { projectId } = req.params;

        const resolved = await resolveGuestLink({ token, projectId });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        const project = await Project.findOne({ publicId: projectId, trashedAt: null }).lean();
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        return res.status(200).json({
            success: true,
            data: {
                publicId: project.publicId,
                name: project.name,
                description: project.description || '',
                coverImageUrl: project.coverImageUrl || null,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch project' });
    }
});

router.get('/packages/:projectId', async (req, res) => {
    try {
        const { token } = req.query;
        const { projectId } = req.params;

        const resolved = await resolveGuestLink({ token, projectId });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);
        const link = resolved.link;

        let query = { projectId, trashedAt: null };
        if (link.shareType === 'packages') {
            query = {
                projectId,
                publicId: { $in: Array.isArray(link.packageIds) ? link.packageIds : [] },
                trashedAt: null,
            };
        }

        const packages = await Package.find(query).select('publicId name status').lean();

        return res.status(200).json({
            success: true,
            data: packages.map(p => ({
                publicId: p.publicId,
                name: p.name,
                status: p.status,
            })),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch packages' });
    }
});

router.get('/package/:projectId/:packageId', async (req, res) => {
    try {
        const { token } = req.query;
        const { projectId, packageId } = req.params;

        const resolved = await resolveGuestLink({ token, projectId, packageId });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        const pkg = await Package.findOne({ publicId: packageId, projectId, trashedAt: null }).lean();
        if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

        return res.status(200).json({
            success: true,
            data: {
                publicId: pkg.publicId,
                projectId: pkg.projectId,
                name: pkg.name,
                description: pkg.description || '',
                status: pkg.status,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch package' });
    }
});

// ── Guest tasks endpoint ───────────────────────────────────────────────────────
router.get('/tasks/:projectId', async (req, res) => {
    try {
        const { token, packageId } = req.query;
        const { projectId } = req.params;
        const requestedPackageId = typeof packageId === 'string' ? packageId.trim() : '';

        const resolved = await resolveGuestLink({
            token,
            projectId,
            packageId: requestedPackageId,
            page: 'tasks',
        });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);
        const link = resolved.link;

        const query = { projectId, trashedAt: null };
        if (requestedPackageId) {
            query.packageId = requestedPackageId;
        } else if (link.shareType === 'packages') {
            query.packageId = { $in: Array.isArray(link.packageIds) ? link.packageIds : [] };
        }

        const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();

        return res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
    }
});

// ── Guest workflow endpoint ────────────────────────────────────────────────────────
router.get('/workflow/:projectId', async (req, res) => {
    try {
        const { token } = req.query;
        const { projectId } = req.params;

        const resolved = await resolveGuestLink({ token, projectId });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        const project = await Project.findOne({ publicId: projectId, trashedAt: null })
            .select('workflow workflowTemplateId').lean();

        const template = project?.workflow?.template || 'construction-standard';
        const stages = Array.isArray(project?.workflow?.stages) && project.workflow.stages.length > 0
            ? project.workflow.stages
            : [];
        const settings = project?.workflow?.settings || {
            autoAssignTasks: false,
            notifyOnStatusChange: true,
            requireApprovalForCompletion: false,
        };

        return res.status(200).json({
            success: true,
            data: {
                template,
                stages,
                settings,
                taskTags: [],
                workflowTemplateId: project?.workflowTemplateId || null,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch workflow' });
    }
});

// ── Guest members endpoint ────────────────────────────────────────────────────
router.get('/members/:projectId', async (req, res) => {
    try {
        const { token, packageId } = req.query;
        const { projectId } = req.params;

        const requestedPackageId = typeof packageId === 'string' ? packageId.trim() : '';
        const resolved = await resolveGuestLink({ token, projectId, packageId: requestedPackageId });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        const pkg = requestedPackageId
            ? await Package.findOne({ publicId: requestedPackageId, projectId, trashedAt: null }).lean()
            : null;

        const packageMemberIds = new Set([
            ...(Array.isArray(pkg?.teamMemberIds) ? pkg.teamMemberIds.map(id => String(id)) : []),
            ...(pkg?.creatorId ? [String(pkg.creatorId)] : []),
        ]);

        const members = await ProjectMember.find({
            projectId,
            status: 'accepted',
            trashedAt: null,
        }).populate('userId').lean();

        const userIdStrings = members.map(m => String(m.userId?._id || m.userId || '')).filter(Boolean);
        const usersMap = {};
        if (userIdStrings.length > 0) {
            const users = await User.find({ _id: { $in: userIdStrings } }).lean();
            users.forEach(u => { usersMap[String(u._id)] = u; });
        }

        const mapped = members
            .map((m, index) => {
                const userIdStr = String(m.userId?._id || m.userId || '');
                const user = usersMap[userIdStr] || null;
                const name = user?.fullName || user?.name || user?.email || 'Unknown';
                const colors = ['#FF2056', '#615FFF', '#00B8DB', '#7CCF00', '#FF9F43', '#EE5A24'];
                if (requestedPackageId && !packageMemberIds.has(userIdStr)) return null;
                return {
                    id: userIdStr,
                    name,
                    email: String(user?.email || ''),
                    role: m.role || 'member',
                    avatar: getInitials(name),
                    avatarUrl: user?.avatar || null,
                    color: colors[index % colors.length],
                    isOnline: false,
                };
            })
            .filter(Boolean);

        return res.status(200).json({ success: true, data: mapped });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch members' });
    }
});

// ── Guest package full data endpoint ──────────────────────────────────────────
router.get('/package-full/:projectId/:packageId', async (req, res) => {
    try {
        const { token } = req.query;
        const { projectId, packageId } = req.params;

        const resolved = await resolveGuestLink({ token, projectId, packageId });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        const pkg = await Package.findOne({ publicId: packageId, projectId, trashedAt: null }).lean();
        if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

        const creator = pkg.creatorId
            ? await User.findById(pkg.creatorId).select('fullName email avatar').lean()
            : null;

        const creatorName = creator?.fullName || creator?.name || creator?.email || 'Unknown';
        const packageMemberIds = new Set([
            ...(Array.isArray(pkg.teamMemberIds) ? pkg.teamMemberIds.map(id => String(id)) : []),
            ...(pkg.creatorId ? [String(pkg.creatorId)] : []),
        ]);

        const members = await ProjectMember.find({
            projectId,
            status: 'accepted',
            trashedAt: null,
        }).populate('userId').lean();

        // Collect unique user IDs to fetch in one query
        const userIdStrings = members.map(m => String(m.userId?._id || m.userId || '')).filter(Boolean);
        const usersMap = {};
        if (userIdStrings.length > 0) {
            const users = await User.find({ _id: { $in: userIdStrings } }).lean();
            users.forEach(u => { usersMap[String(u._id)] = u; });
        }

        const scopedMembers = members
            .map((m, index) => {
                const userIdStr = String(m.userId?._id || m.userId || '');
                const user = usersMap[userIdStr] || null;
                const name = user?.fullName || user?.name || user?.email || 'Unknown';
                const colors = ['#FF2056', '#615FFF', '#00B8DB', '#7CCF00', '#FF9F43', '#EE5A24'];
                return packageMemberIds.has(userIdStr) ? {
                    id: userIdStr,
                    name,
                    email: String(user?.email || ''),
                    role: m.role || 'member',
                    avatar: getInitials(name),
                    avatarUrl: user?.avatar || null,
                    color: colors[index % colors.length],
                } : null;
            })
            .filter(Boolean);

        console.log('[Guest] packageMemberIds:', [...packageMemberIds], 'members count:', members.length, 'filtered:', scopedMembers.length);
        const tasks = await Task.find({ projectId, packageId: packageId, trashedAt: null }).lean();
        const documentsCount = await Document.countDocuments({ projectId, packageId: packageId, trashedAt: null });

        return res.status(200).json({
            success: true,
            data: {
                publicId: pkg.publicId,
                projectId: pkg.projectId,
                name: pkg.name,
                description: pkg.description || '',
                status: pkg.status,
                lifecycleStatus: pkg.lifecycleStatus,
                progress: pkg.progress,
                dueDate: pkg.dueDate,
                creatorId: pkg.creatorId,
                creatorName,
                teamMemberIds: pkg.teamMemberIds,
                teamMembers: scopedMembers,
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => ['done', 'completed', 'approved'].includes(String(t.status).toLowerCase())).length,
                documentsCount,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to fetch package' });
    }
});

const IFC_EXTENSION = '.ifc';

function buildDocumentsTree({ docs, folders, rootName = 'All Files', rootId = 'root', versionCounts = new Map() }) {
    const treeMap = new Map();
    treeMap.set(rootId, { id: rootId, name: rootName, type: 'folder', children: [] });

    const ensureFolderNode = (parentKey, name, fullKey) => {
        if (treeMap.has(fullKey)) return treeMap.get(fullKey);
        const node = { id: fullKey, name, type: 'folder', icon: 'folder', children: [] };
        treeMap.set(fullKey, node);
        treeMap.get(parentKey).children.push(node);
        return node;
    };

    const resolveFolderChain = (folderPath = '') => {
        if (!folderPath) return rootId;
        const segments = String(folderPath).split('/').map(s => s.trim()).filter(Boolean);
        let parentKey = rootId;
        let currentPath = rootId;
        for (const segment of segments) {
            currentPath = `${currentPath}/${segment}`;
            ensureFolderNode(parentKey, segment, currentPath);
            parentKey = currentPath;
        }
        return parentKey;
    };

    for (const folder of folders || []) resolveFolderChain(folder.folderPath || '');

    const latestByVersionGroup = new Map();
    for (const doc of docs || []) {
        const vgId = doc.versionGroupId || doc.publicId;
        const existing = latestByVersionGroup.get(vgId);
        if (!existing || doc.versionNumber > existing.versionNumber) latestByVersionGroup.set(vgId, doc);
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
        for (const child of node.children) if (child.type === 'folder') sortNode(child);
    };

    const root = treeMap.get(rootId);
    sortNode(root);
    return root;
}

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// ── Guest package documents endpoint ───────────────────────────────────────────
router.get('/documents/:projectId/:packageId', async (req, res) => {
    try {
        const { token } = req.query;
        const { projectId, packageId } = req.params;

        const resolved = await resolveGuestLink({ token, projectId, packageId, page: 'documents' });
        if (!resolved.link) return res.status(resolved.status).json(resolved.body);

        const [docs, folders] = await Promise.all([
            DocumentRepository.listByProjectAndPackage(projectId, packageId),
            DocumentFolderRepository.listByProjectAndPackage(projectId, packageId),
        ]);

        const approvedDocs = (docs || []).filter(
            doc => doc.approvalStatus !== 'pending' && doc.approvalStatus !== 'rejected'
        );

        const allVgIds = [...new Set((docs || []).map(d => d.versionGroupId || d.publicId))];
        const versionCounts = new Map();
        if (allVgIds.length > 0) {
            const counts = await DocumentRepository.countVersionsByVersionGroupIds(allVgIds);
            counts.forEach(c => versionCounts.set(c._id, c.count));
        }

        const rootId = `root/pkg/${packageId}`;
        const tree = buildDocumentsTree({
            docs: approvedDocs,
            folders,
            rootName: 'Documents',
            rootId,
            versionCounts,
        });

        return res.status(200).json({
            success: true,
            data: {
                tree,
                total: approvedDocs.length,
            },
        });
    } catch (error) {
        console.error('[Guest] documents error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load documents' });
    }
});

module.exports = router;
