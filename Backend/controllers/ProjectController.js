const Project = require('../models/Project');
const Folder = require('../models/Folder');
const User = require('../models/User');
const Task = require('../models/Task');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');
const ProjectRoleRepository = require('../repositories/ProjectRoleRepository');
const { getJson, setJson, delKeys } = require('../services/cacheService');
const socketService = require('../services/socketService');
const { invalidateUserCache } = socketService;
const { normalizeString } = require('../utils/sanitize');
const { errorResponse } = require('../utils/response');
const { buildSupabaseThumbnailPath, buildSupabaseAvatarPath, uploadProjectThumbnailBuffer, uploadAvatarBuffer, deleteAvatarFile } = require('../services/supabaseStorageService');
const { evaluatePackageLifecycle } = require('../utils/packageLifecycle');

// System roles to initialize for new projects
const systemRoles = [
    { name: 'Project Owner', accessLevel: 'full', isSystem: true, roleKey: 'owner', description: 'Full control over the project and all settings', color: '#8B5CF6', permissions: ['All Permissions'] },
    { name: 'Admin', accessLevel: 'high', isSystem: true, roleKey: 'admin', description: 'Can manage project, members, and approve changes', color: '#EF4444', permissions: ['View All', 'Edit All', 'Delete Content', 'Manage Team', 'Approve Changes'] },
    { name: 'Manager', accessLevel: 'high', isSystem: true, roleKey: 'manager', description: 'Can manage tasks, approve changes, and assign work', color: '#F59E0B', permissions: ['View All', 'Edit All', 'Approve Changes', 'Assign Tasks', 'Manage Workflow'] },
    { name: 'Member', accessLevel: 'medium', isSystem: true, roleKey: 'member', description: 'Can create and edit content, submit changes', color: '#10B981', permissions: ['View All', 'Edit Own', 'Create Content', 'Submit Changes'] },
    { name: 'Viewer', accessLevel: 'minimal', isSystem: true, roleKey: 'viewer', description: 'View-only access to project content', color: '#6B7280', permissions: ['View All'] },
];

const getNormalizedProjectId = (req) => normalizeString(req.body?.projectId);

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res, message) => errorResponse(res, 403, message || "You don't have permission to delete this project. Only the project owner can perform this action.");
const notFound = (res, message) => errorResponse(res, 404, message);
const serverError = (res, message) => errorResponse(res, 500, message);
const handleBadRequest = (res, message) => badRequest(res, message);
const handleServerError = (res, message) => serverError(res, message);

// Helper: Check if userId is owner of project (handles both ObjectId and publicId)
const isProjectOwner = async (project, userId) => {
    if (project.ownerId === userId) return true;
    
    if (/^[0-9a-fA-F]{24}$/.test(project.ownerId)) {
        const ownerUser = await User.findById(project.ownerId).select('publicId').lean();
        return ownerUser?.publicId === userId;
    } else {
        const currentUser = await User.findById(userId).select('publicId').lean();
        return project.ownerId === currentUser?.publicId;
    }
};

const requireUserId = (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        unauthorized(res);
        return null;
    }
    return userId;
};

const getProjectsCacheKey = (userId) => `projects:me:${userId}`;
const getFoldersCacheKey = (userId) => `folders:me:${userId}`;
const invalidateUserCaches = async (userId) => {
    // Bust server-side Redis cache
    await delKeys([getProjectsCacheKey(userId), getFoldersCacheKey(userId)]);
    // Notify the connected client so it busts its client-side (sessionStorage / in-memory) cache
    invalidateUserCache(userId, ['projects', 'folders']);
};

const workflowTemplates = {
    'construction-standard': [
        { id: 'backlog',      label: 'Backlog',      color: '#6A7280' },
        { id: 'todo',         label: 'To Do',         color: '#155DFC' },
        { id: 'in-progress',  label: 'In Progress',   color: '#F59E0B' },
        { id: 'review',       label: 'Review',        color: '#8B5CF6' },
        { id: 'done',         label: 'Done',           color: '#10B981' },
    ],
    'agile-scrum': [
        { id: 'product-backlog', label: 'Product Backlog', color: '#6A7280' },
        { id: 'sprint-backlog', label: 'Sprint Backlog', color: '#155DFC' },
        { id: 'in-progress',    label: 'In Progress',    color: '#F59E0B' },
        { id: 'testing',        label: 'Testing',        color: '#EF4444' },
        { id: 'review',         label: 'Review',          color: '#8B5CF6' },
        { id: 'done',           label: 'Done',             color: '#10B981' },
    ],
    'design-review': [
        { id: 'draft',     label: 'Draft',     color: '#6A7280' },
        { id: 'review',    label: 'Review',    color: '#155DFC' },
        { id: 'revision',  label: 'Revision',  color: '#F59E0B' },
        { id: 'approved',  label: 'Approved',  color: '#10B981' },
    ],
};

class ProjectController {
    async createProject(req, res) {
        try {
            const { name, description, industry, coverImageUrl } = req.body || {};
            const normalizedName = normalizeString(name);
            const normalizedDescription = normalizeString(description);
            const normalizedIndustry = normalizeString(industry);
            const normalizedCoverImageUrl = normalizeString(coverImageUrl);

            if (!normalizedName) {
                return badRequest(res, 'Project name is required');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            // Get user's publicId for ownerId field
            const user = await User.findById(userId).select('publicId').lean();
            if (!user) return unauthorized(res);

            const project = await Project.create({
                ownerId: user.publicId, // Lưu user's publicId thay vì MongoDB _id
                name: normalizedName,
                description: normalizedDescription,
                industry: normalizedIndustry,
                coverImageUrl: normalizedCoverImageUrl,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await ProjectMemberRepository.addMember({
                projectId: project.publicId,
                userId,
                role: 'owner',
                status: 'accepted',
                invitedBy: null,
            });

            // Initialize system roles for new project
            for (const role of systemRoles) {
                await ProjectRoleRepository.createRole({
                    projectId: project.publicId,
                    ...role,
                });
            }

            await invalidateUserCaches(userId);

            // Broadcast project:updated so creator's project list refreshes
            socketService.broadcastProject(project.publicId, 'project:updated', {
                projectId: project.publicId,
                changes: { name: project.name, description: project.description },
            });

            return res.status(201).json({
                success: true,
                message: 'Project created',
                data: {
                    publicId: project.publicId,
                    name: project.name,
                    description: project.description,
                    industry: project.industry,
                    coverImageUrl: project.coverImageUrl,
                    folderId: project.folderId,
                },
            });
        } catch (error) {
            return handleBadRequest(res, 'Create project failed');
        }
    }

    async getMyProjects(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const cacheKey = getProjectsCacheKey(userId);

            // Clear cache to ensure fresh data
            await delKeys(cacheKey);

            const memberships = await ProjectMemberRepository.getProjectsByUser(userId);
            const projectIds = memberships.map((membership) => membership.projectId);

            const projects = await Project.find({ publicId: { $in: projectIds }, trashedAt: null }).select(
                '-_id -updatedAt'
            );

            const membershipMap = new Map(
                memberships.map((membership) => [membership.projectId, membership])
            );

            // Compute project progress from package + task data in parallel
            const progressResults = await Promise.all(
                projects.map(async (project) => {
                    try {
                        const pkgStatusResult = await require('../repositories/PackageRepository').findByProjectId(project.publicId);
                        const packages = Array.isArray(pkgStatusResult) ? pkgStatusResult : [];
                        if (packages.length === 0) return { projectId: project.publicId, progress: 0 };

                        const pkgIds = packages.map((p) => p.publicId).filter(Boolean);
                        const stages = Array.isArray(project.workflow?.stages) ? project.workflow.stages : [];
                        const doneStatuses = stages.map((s) => String(s.id || '').toLowerCase()).filter(Boolean);

                        const [taskAgg, docAgg] = await Promise.all([
                            Task.aggregate([
                                { $match: { projectId: project.publicId, packageId: { $in: pkgIds } } },
                                {
                                    $group: {
                                        _id: '$packageId',
                                        taskTotal: { $sum: 1 },
                                        doneTaskTotal: {
                                            $sum: {
                                                $cond: [
                                                    { $in: [{ $toLower: '$status' }, doneStatuses] },
                                                    1,
                                                    0,
                                                ],
                                            },
                                        },
                                    },
                                },
                            ]),
                            require('../models/Document').aggregate([
                                { $match: { projectId: project.publicId, packageId: { $in: pkgIds } } },
                                { $group: { _id: '$packageId', documentTotal: { $sum: 1 } } },
                            ]),
                        ]);

                        const taskMap = new Map(taskAgg.map((r) => [String(r._id), r]));
                        const docMap = new Map(docAgg.map((r) => [String(r._id), r]));

                        let totalProgress = 0;
                        let packageCount = 0;

                        for (const pkg of packages) {
                            const pid = String(pkg.publicId || '');
                            if (!pid) continue;
                            const taskStat = taskMap.get(pid) || {};
                            const docStat = docMap.get(pid) || {};
                            const memberSet = new Set([
                                ...(Array.isArray(pkg.teamMemberIds) ? pkg.teamMemberIds : []),
                                ...(pkg.creatorId ? [pkg.creatorId] : []),
                            ]);

                            const lifecycle = evaluatePackageLifecycle({
                                dbStatus: pkg.status,
                                taskTotal: Number(taskStat.taskTotal || 0),
                                doneTaskTotal: Number(taskStat.doneTaskTotal || 0),
                                documentTotal: Number(docStat.documentTotal || 0),
                                memberTotal: memberSet.size,
                            });

                            totalProgress += lifecycle.progress;
                            packageCount++;
                        }

                        return {
                            projectId: project.publicId,
                            progress: packageCount > 0 ? Math.round(totalProgress / packageCount) : 0,
                        };
                    } catch {
                        return { projectId: project.publicId, progress: 0 };
                    }
                })
            );

            const progressMap = new Map(progressResults.map((r) => [r.projectId, r.progress]));

            const data = projects.map((project) => {
                const membership = membershipMap.get(project.publicId);
                return {
                    publicId: project.publicId,
                    name: project.name,
                    description: project.description,
                    industry: project.industry,
                    coverImageUrl: project.coverImageUrl,
                    folderIds: Array.isArray(project.folderIds) ? project.folderIds : [],
                    role: membership?.role || 'member',
                    status: membership?.status || 'accepted',
                    lastVisitedAt: membership?.lastVisitedAt || null,
                    isFavorite: membership?.isFavorite || false,
                    progress: progressMap.get(project.publicId) || 0,
                };
            });

            await setJson(cacheKey, data, 60);

            return res.status(200).json({
                success: true,
                data,
            });
        } catch (error) {
            return handleServerError(res, 'Failed to load projects');
        }
    }

    async getProjectMembers(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            const rawMembers = await ProjectMemberRepository.getMembersWithUsers(normalizedProjectId);

            // Collect user info - handle both ObjectId and publicId userIds
            const userIds = [...new Set(rawMembers.map((m) => m.userId).filter(Boolean))];
            const { Types } = require('mongoose');
            const validObjectIds = userIds.filter((id) => /^[a-f\d]{24}$/i.test(id));
            const publicIds = userIds.filter((id) => !/^[a-f\d]{24}$/i.test(id));

            // Fetch by _id (for ObjectId userIds)
            const userDocsById = validObjectIds.length
                ? await require('../models/User').find({ _id: { $in: validObjectIds.map((id) => new Types.ObjectId(id)) } }).select('_id publicId fullName email avatar').lean()
                : [];
            // Fetch by publicId (for publicId userIds)
            const userDocsByPublicId = publicIds.length
                ? await require('../models/User').find({ publicId: { $in: publicIds } }).select('_id publicId fullName email avatar').lean()
                : [];

            // Build userMap with both _id and publicId as keys
            const userMap = new Map();
            userDocsById.forEach((u) => {
                userMap.set(String(u._id), u);
                userMap.set(u.publicId, u); // also map by publicId
            });
            userDocsByPublicId.forEach((u) => {
                userMap.set(u.publicId, u);
                userMap.set(String(u._id), u); // also map by _id
            });

            const members = rawMembers.map((m) => ({
                publicId: String(m._id),
                userId: m.userId,
                role: m.role,
                status: m.status,
                invitedBy: m.invitedBy,
                createdAt: m.createdAt,
                isFavorite: m.isFavorite || false,
                user: m.userId ? (() => {
                    // Try both userId (could be ObjectId or publicId) and lookup in map
                    const u = userMap.get(m.userId);
                    return u ? { fullName: u.fullName, email: u.email, avatar: u.avatar } : null;
                })() : null,
            }));

            return res.status(200).json({
                success: true,
                data: members,
                isFavorite: member.isFavorite || false,
                currentUserId: userId,
                currentRole: member.role || 'member',
            });
        } catch (error) {
            console.error('getProjectMembers error:', error);
            return handleServerError(res, 'Failed to load project members');
        }
    }

    async getMemberCounts(req, res) {
        try {
            const { projectIds } = req.body || {};
            const normalizedIds = Array.isArray(projectIds) ? projectIds.filter(Boolean) : [];

            if (normalizedIds.length === 0) {
                return res.status(200).json({ success: true, data: {} });
            }

            const counts = {};
            await Promise.all(
                normalizedIds.map(async (projectId) => {
                    const count = await ProjectMemberRepository.countAcceptedMembers(projectId);
                    counts[projectId] = count;
                })
            );

            return res.status(200).json({ success: true, data: counts });
        } catch (error) {
            console.error('getMemberCounts error:', error);
            return handleServerError(res, 'Failed to get member counts');
        }
    }

    async updateProject(req, res) {
        try {
            const { projectId, name, description, industry, coverImageUrl } = req.body || {};
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return forbidden(res);
            }

            const updateFields = {
                updatedAt: new Date(),
            };
            if (name !== undefined) updateFields.name = normalizeString(name);
            if (description !== undefined) updateFields.description = normalizeString(description);
            if (industry !== undefined) updateFields.industry = normalizeString(industry);
            if (coverImageUrl !== undefined) updateFields.coverImageUrl = normalizeString(coverImageUrl);

            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                updateFields,
                { returnDocument: 'after' }
            );

            if (!project) {
                return notFound(res, 'Project not found');
            }

            await invalidateUserCaches(userId);

            // Broadcast so all project members see the updated name/icon/status
            socketService.broadcastProject(normalizedProjectId, 'project:updated', {
                projectId: normalizedProjectId,
                changes: { name: project.name, description: project.description, industry: project.industry, coverImageUrl: project.coverImageUrl },
            });

            return res.status(200).json({
                success: true,
                message: 'Project updated',
                data: {
                    publicId: project.publicId,
                    name: project.name,
                    description: project.description,
                    industry: project.industry,
                    coverImageUrl: project.coverImageUrl,
                },
            });
        } catch (error) {
            return badRequest(res, 'Update project failed');
        }
    }

    async uploadThumbnail(req, res) {
        try {
            const { projectId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);

            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return forbidden(res);
            }

            const file = req.file;
            if (!file) {
                return badRequest(res, 'No file uploaded');
            }

            const fileName = file.originalname || 'thumbnail.jpg';
            const storagePath = buildSupabaseThumbnailPath({
                projectId: normalizedProjectId,
                fileName: fileName,
            });

            const { publicUrl } = await uploadProjectThumbnailBuffer(file.buffer, storagePath);

            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                { coverImageUrl: publicUrl, updatedAt: new Date() },
                { returnDocument: 'after' }
            );

            if (!project) {
                return notFound(res, 'Project not found');
            }

            await invalidateUserCaches(userId);

            socketService.broadcastProject(normalizedProjectId, 'project:updated', {
                projectId: normalizedProjectId,
                changes: { coverImageUrl: project.coverImageUrl },
            });

            return res.status(200).json({
                success: true,
                message: 'Thumbnail uploaded',
                data: {
                    publicId: project.publicId,
                    coverImageUrl: project.coverImageUrl,
                },
            });
        } catch (error) {
            console.error('Upload thumbnail error:', error);
            return badRequest(res, 'Upload thumbnail failed');
        }
    }

    async uploadAvatar(req, res) {
        try {
            const { projectId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);

            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return forbidden(res);
            }

            const file = req.file;
            if (!file) {
                return badRequest(res, 'No file uploaded');
            }

            const existingProject = await Project.findOne({ publicId: normalizedProjectId });
            if (!existingProject) {
                return notFound(res, 'Project not found');
            }

            if (existingProject.avatarStoragePath) {
                try {
                    await deleteAvatarFile(existingProject.avatarStoragePath);
                } catch (err) {
                    console.warn('[Avatar] Failed to delete old avatar:', err.message);
                }
            }

            const storagePath = buildSupabaseAvatarPath({
                projectId: normalizedProjectId,
                fileName: file.originalname || 'avatar.png',
            });

            const { publicUrl } = await uploadAvatarBuffer(file.buffer, storagePath);

            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                { coverImageUrl: publicUrl, avatarStoragePath: storagePath, updatedAt: new Date() },
                { returnDocument: 'after' }
            );

            await invalidateUserCaches(userId);

            socketService.broadcastProject(normalizedProjectId, 'project:updated', {
                projectId: normalizedProjectId,
                changes: { coverImageUrl: project.coverImageUrl },
            });

            return res.status(200).json({
                success: true,
                message: 'Avatar uploaded',
                data: {
                    publicId: project.publicId,
                    coverImageUrl: project.coverImageUrl,
                },
            });
        } catch (error) {
            console.error('Upload avatar error:', error);
            return badRequest(res, 'Upload avatar failed');
        }
    }

    async deleteAvatar(req, res) {
        try {
            const { projectId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);

            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return forbidden(res);
            }

            const project = await Project.findOne({ publicId: normalizedProjectId });
            if (!project) {
                return notFound(res, 'Project not found');
            }

            if (project.avatarStoragePath) {
                try {
                    await deleteAvatarFile(project.avatarStoragePath);
                } catch (err) {
                    console.warn('[Avatar] Failed to delete avatar:', err.message);
                }
            }

            await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                { coverImageUrl: '', avatarStoragePath: null, updatedAt: new Date() }
            );

            await invalidateUserCaches(userId);

            socketService.broadcastProject(normalizedProjectId, 'project:updated', {
                projectId: normalizedProjectId,
                changes: { coverImageUrl: '' },
            });

            return res.status(200).json({
                success: true,
                message: 'Avatar deleted',
            });
        } catch (error) {
            console.error('Delete avatar error:', error);
            return badRequest(res, 'Delete avatar failed');
        }
    }

    async deleteProject(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const project = await Project.findOne({ publicId: normalizedProjectId });
            if (!project) {
                return notFound(res, 'Project not found');
            }

            if (project.ownerId !== userId) {
                return forbidden(res);
            }

            await Project.deleteOne({ publicId: normalizedProjectId });
            await ProjectMemberRepository.removeMembersByProject(normalizedProjectId);
            await ProjectInviteRepository.removeByProject(normalizedProjectId);

            // Invalidate all project members' caches so their project list refreshes
            const members = await ProjectMemberRepository.getMembersByProject(normalizedProjectId);
            await Promise.all(members.map((m) => invalidateUserCaches(m.userId)));

            return res.status(200).json({
                success: true,
                message: 'Project deleted',
            });
        } catch (error) {
            return serverError(res, 'Delete project failed');
        }
    }

    async moveProjectToFolder(req, res) {
        try {
            const { projectId, folderId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFolderId = normalizeString(folderId);

            if (!normalizedProjectId || !normalizedFolderId) {
                return badRequest(res, 'Missing projectId or folderId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            const folder = await Folder.findOne({
                publicId: normalizedFolderId,
                ownerId: userId,
            });

            if (!folder) {
                return notFound(res, 'Folder not found');
            }

            const project = await Project.findOne({ publicId: normalizedProjectId });
            if (!project) {
                return notFound(res, 'Project not found');
            }

            const nextFolderIds = Array.isArray(project.folderIds)
                ? project.folderIds
                : [];

            if (!nextFolderIds.includes(normalizedFolderId)) {
                nextFolderIds.push(normalizedFolderId);
            }

            project.folderIds = nextFolderIds;
            project.updatedAt = new Date();
            await project.save();

            await invalidateUserCaches(userId);

            return res.status(200).json({
                success: true,
                message: 'Project moved',
                data: {
                    publicId: project.publicId,
                    folderIds: project.folderIds,
                },
            });
        } catch (error) {
            return badRequest(res, 'Move project failed');
        }
    }

    async removeProjectFromFolder(req, res) {
        try {
            const { projectId, folderId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedFolderId = normalizeString(folderId);

            if (!normalizedProjectId || !normalizedFolderId) {
                return badRequest(res, 'Missing projectId or folderId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                {
                    $pull: { folderIds: normalizedFolderId },
                    updatedAt: new Date(),
                },
                { returnDocument: 'after' }
            );

            if (!project) {
                return notFound(res, 'Project not found');
            }

            await invalidateUserCaches(userId);

            return res.status(200).json({
                success: true,
                message: 'Project removed from folder',
                data: {
                    publicId: project.publicId,
                    folderIds: project.folderIds,
                },
            });
        } catch (error) {
            return badRequest(res, 'Remove from folder failed');
        }
    }

    async updateMemberRole(req, res) {
        try {
            const { projectId, targetUserId, role } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedTargetUserId = normalizeString(targetUserId);
            const normalizedRole = normalizeString(role);
            if (!normalizedProjectId || !normalizedTargetUserId || !normalizedRole) {
                return badRequest(res, 'Missing projectId, targetUserId or role');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            if (normalizedTargetUserId === userId) {
                return forbidden(res);
            }

            const targetMember = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                normalizedTargetUserId
            );
            if (!targetMember) {
                return notFound(res, 'Member not found');
            }

            // Owner cannot have their role changed by anyone
            if (targetMember.role === 'owner') {
                return forbidden(res, 'The project owner role cannot be changed');
            }

            // Only owner can change admin's role, admins can only change non-admin members
            if (targetMember.role === 'admin') {
                if (member.role !== 'owner') {
                    return forbidden(res, 'Only the project owner can change admin roles');
                }
            } else if (member.role !== 'admin' && member.role !== 'owner') {
                return forbidden(res);
            }

            const updatedMember = await ProjectMemberRepository.updateMemberRole(
                normalizedProjectId,
                normalizedTargetUserId,
                normalizedRole
            );

            await invalidateUserCaches(userId);

            // Broadcast so UI role/permissions update immediately
            socketService.broadcastProject(normalizedProjectId, 'project:member:role-updated', {
                projectId: normalizedProjectId,
                userId: normalizedTargetUserId,
                role: normalizedRole,
            });

            return res.status(200).json({
                success: true,
                message: 'Member role updated',
                data: {
                    projectId: updatedMember.projectId,
                    userId: updatedMember.userId,
                    role: updatedMember.role,
                },
            });
        } catch (error) {
            return badRequest(res, 'Update member role failed');
        }
    }

    async removeMember(req, res) {
        try {
            const { projectId, targetUserId, userId: bodyUserId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedTargetUserId = normalizeString(targetUserId || bodyUserId);
            if (!normalizedProjectId || !normalizedTargetUserId) {
                return badRequest(res, 'Missing projectId or targetUserId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            if (normalizedTargetUserId === userId) {
                return forbidden(res);
            }

            const targetMember = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                normalizedTargetUserId
            );
            if (!targetMember) {
                return notFound(res, 'Member not found');
            }

            // Owner cannot be removed by anyone
            if (targetMember.role === 'owner') {
                return forbidden(res, 'The project owner cannot be removed');
            }

            // Admins cannot remove each other (only owner can remove admin)
            if (targetMember.role === 'admin' && member.role === 'admin') {
                return forbidden(res, 'Admins cannot remove each other');
            }

            // Only owner can remove admin, admins can only remove non-admin members
            if (targetMember.role === 'admin') {
                if (member.role !== 'owner') {
                    return forbidden(res, 'Only the project owner can remove admins');
                }
            } else if (member.role !== 'admin' && member.role !== 'owner') {
                return forbidden(res);
            }

            await ProjectMemberRepository.removeMember(normalizedProjectId, normalizedTargetUserId);

            // Invalidate both the admin's and removed member's cache
            await Promise.all([
                invalidateUserCaches(userId),
                invalidateUserCaches(normalizedTargetUserId),
            ]);

            // Tell the removed member to redirect away from this project
            socketService.notifyUser(normalizedTargetUserId, 'member:removed', {
                projectId: normalizedProjectId,
            });

            // Broadcast to remaining project members so they see the updated member list
            socketService.broadcastProject(normalizedProjectId, 'project:member:left', {
                projectId: normalizedProjectId,
                userId: normalizedTargetUserId,
            });

            return res.status(200).json({
                success: true,
                message: 'Member removed',
            });
        } catch (error) {
            return handleServerError(res, 'Remove member failed');
        }
    }

    async touchProject(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return unauthorized(res);
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            await ProjectMemberRepository.updateLastVisited(normalizedProjectId, userId);
            await invalidateUserCaches(userId);

            return res.status(200).json({ success: true });
        } catch (error) {
            return handleServerError(res, 'Touch project failed');
        }
    }

    async getWorkflow(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) return forbidden(res);

            const project = await Project.findOne({ publicId: normalizedProjectId }).select('publicId workflow workflowTemplateId');
            if (!project) return notFound(res, 'Project not found');

            const template = project.workflow?.template || 'construction-standard';
            const stages = Array.isArray(project.workflow?.stages) && project.workflow.stages.length > 0
                ? project.workflow.stages
                : (workflowTemplates[template] || workflowTemplates['construction-standard']);
            const settings = project.workflow?.settings || {
                autoAssignTasks: false,
                notifyOnStatusChange: true,
                requireApprovalForCompletion: false,
            };
            const taskTags = Array.isArray(project.workflow?.taskTags) ? project.workflow.taskTags : [];

            return res.status(200).json({
                success: true,
                data: { template, stages, settings, taskTags, workflowTemplateId: project.workflowTemplateId },
            });
        } catch (error) {
            return handleServerError(res, 'Failed to load workflow');
        }
    }

    async applyWorkflowTemplate(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            const { workflowTemplateId } = req.body || {};
            
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            if (!workflowTemplateId) {
                return badRequest(res, 'Missing workflowTemplateId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) return forbidden(res);

            // Fetch the workflow template
            const WorkflowTemplate = require('../models/WorkflowTemplate');
            const template = await WorkflowTemplate.findOne({ publicId: workflowTemplateId });
            
            if (!template) {
                return notFound(res, 'Workflow template not found');
            }

            // Update project with template stages
            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                {
                    workflowTemplateId: workflowTemplateId,
                    workflow: {
                        template: template.name,
                        stages: template.stages.map(s => ({ id: s.id, label: s.name })),
                        settings: {
                            autoAssignTasks: false,
                            notifyOnStatusChange: true,
                            requireApprovalForCompletion: false,
                        },
                        taskTags: [],
                    },
                    updatedAt: new Date(),
                },
                { returnDocument: 'after' }
            );

            if (!project) return notFound(res, 'Project not found');

            await invalidateUserCaches(userId);
            socketService.broadcastProject(normalizedProjectId, 'project:workflow-updated', {
                projectId: normalizedProjectId,
                workflowTemplateId,
                workflow: project.workflow,
            });

            return res.status(200).json({
                success: true,
                message: 'Workflow template applied',
                data: {
                    workflowTemplateId: project.workflowTemplateId,
                    workflow: project.workflow,
                },
            });
        } catch (error) {
            console.error('Error applying workflow template:', error);
            return handleServerError(res, 'Failed to apply workflow template');
        }
    }

    async updateWorkflow(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            const { template, stages, settings, taskTags } = req.body || {};
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) return forbidden(res);

            const nextTemplate = normalizeString(template) || 'construction-standard';
            const normalizedStages = Array.isArray(stages)
                ? stages
                    .map((s) => {
                        const id = normalizeString(s?.id || s?.key || s?.name);
                        const label = normalizeString(s?.label || s?.name || s?.id);
                        if (!id || !label) return null;
                        return { id, label };
                    })
                    .filter(Boolean)
                : null;

            const nextStages = normalizedStages && normalizedStages.length > 0
                ? normalizedStages
                : (workflowTemplates[nextTemplate] || workflowTemplates['construction-standard']);

            const nextSettings = {
                autoAssignTasks: Boolean(settings?.autoAssignTasks),
                notifyOnStatusChange: settings?.notifyOnStatusChange !== false,
                requireApprovalForCompletion: Boolean(settings?.requireApprovalForCompletion),
            };

            const normalizedTaskTags = Array.isArray(taskTags)
                ? taskTags
                    .map((t) => {
                        const id = normalizeString(t?.id) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                        const name = normalizeString(t?.name);
                        if (!name) return null;
                        return {
                            id,
                            name,
                            description: normalizeString(t?.description) || '',
                            color: normalizeString(t?.color) || '#6366F1',
                        };
                    })
                    .filter(Boolean)
                : null;

            const existingProject = await Project.findOne({ publicId: normalizedProjectId }).select('workflow');
            if (!existingProject) return notFound(res, 'Project not found');

            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                {
                    workflow: {
                        template: nextTemplate,
                        stages: nextStages,
                        settings: nextSettings,
                        taskTags: normalizedTaskTags || existingProject?.workflow?.taskTags || [],
                    },
                    updatedAt: new Date(),
                },
                { returnDocument: 'after' }
            );

            if (!project) return notFound(res, 'Project not found');

            await invalidateUserCaches(userId);
            socketService.broadcastProject(normalizedProjectId, 'project:updated', {
                projectId: normalizedProjectId,
                changes: { workflow: project.workflow },
            });

            return res.status(200).json({
                success: true,
                message: 'Workflow updated',
                data: project.workflow,
            });
        } catch (error) {
            return handleServerError(res, 'Failed to update workflow');
        }
    }

    async toggleFavorite(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member) {
                return forbidden(res);
            }

            const updatedMember = await ProjectMemberRepository.toggleFavorite(normalizedProjectId, userId);
            await invalidateUserCaches(userId);

            socketService.broadcastProject(normalizedProjectId, 'project:favorite-toggled', {
                projectId: normalizedProjectId,
                userId,
                isFavorite: updatedMember.isFavorite,
            });

            return res.status(200).json({
                success: true,
                message: updatedMember.isFavorite ? 'Project added to favorites' : 'Project removed from favorites',
                data: {
                    projectId: normalizedProjectId,
                    isFavorite: updatedMember.isFavorite,
                },
            });
        } catch (error) {
            return handleServerError(res, 'Toggle favorite failed');
        }
    }

    async trashProject(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) return badRequest(res, 'Missing projectId');

            const userId = requireUserId(req, res);
            if (!userId) return;

            const project = await Project.findOne({ publicId: normalizedProjectId });
            if (!project) return notFound(res, 'Project not found');

            if (!(await isProjectOwner(project, userId))) return forbidden(res);

            project.trashedAt = new Date();
            project.trashedBy = userId;
            project.updatedAt = new Date();
            await project.save();

            await invalidateUserCaches(userId);

            socketService.broadcastProject(normalizedProjectId, 'project:trashed', { projectId: normalizedProjectId });

            return res.status(200).json({ success: true, message: 'Project moved to trash' });
        } catch (error) {
            return serverError(res, 'Trash project failed');
        }
    }

    async restoreProject(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) return badRequest(res, 'Missing projectId');

            const userId = requireUserId(req, res);
            if (!userId) return;

            const project = await Project.findOne({ publicId: normalizedProjectId, trashedAt: { $ne: null } });
            if (!project) return notFound(res, 'Trashed project not found');

            if (!(await isProjectOwner(project, userId))) return forbidden(res);

            project.trashedAt = null;
            project.trashedBy = null;
            project.updatedAt = new Date();
            await project.save();

            await invalidateUserCaches(userId);

            socketService.broadcastProject(normalizedProjectId, 'project:restored', { projectId: normalizedProjectId });

            return res.status(200).json({ success: true, message: 'Project restored' });
        } catch (error) {
            return serverError(res, 'Restore project failed');
        }
    }

    async deletePermanentProject(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            if (!normalizedProjectId) return badRequest(res, 'Missing projectId');

            const userId = requireUserId(req, res);
            if (!userId) return;

            const project = await Project.findOne({ publicId: normalizedProjectId });
            if (!project) return notFound(res, 'Project not found');

            if (!(await isProjectOwner(project, userId))) return forbidden(res);

            await Project.deleteOne({ publicId: normalizedProjectId });
            await ProjectMemberRepository.removeMembersByProject(normalizedProjectId);
            await ProjectInviteRepository.removeByProject(normalizedProjectId);

            await invalidateUserCaches(userId);

            return res.status(200).json({ success: true, message: 'Project permanently deleted' });
        } catch (error) {
            return serverError(res, 'Delete permanent failed');
        }
    }

    async getTrashProjects(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const user = await User.findById(userId).select('publicId').lean();
            if (!user) return unauthorized(res);
            const ownerPublicId = user.publicId;

            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            const now = new Date();
            const cutoff = new Date(now.getTime() - THIRTY_DAYS_MS);

            // Auto-purge projects older than 30 days in trash
            const expired = await Project.find({
                ownerId: ownerPublicId,
                trashedAt: { $ne: null, $lte: cutoff },
            }).select('publicId').lean();
            if (expired.length > 0) {
                const expiredIds = expired.map(p => p.publicId);
                await Project.deleteMany({ publicId: { $in: expiredIds } });
                for (const eid of expiredIds) {
                    await ProjectMemberRepository.removeMembersByProject(eid);
                    await ProjectInviteRepository.removeByProject(eid);
                }
                await invalidateUserCaches(userId);
            }

            const trashedProjects = await Project.find({
                ownerId: ownerPublicId,
                trashedAt: { $ne: null, $gt: cutoff },
            }).lean();

            // Resolve trashedBy user names
            const trasherIds = [...new Set(trashedProjects.map(p => p.trashedBy).filter(Boolean))];
            let trasherMap = {};
            if (trasherIds.length > 0) {
                const mongoose = require('mongoose');
                const validIds = trasherIds.filter(id => { try { return mongoose.Types.ObjectId.isValid(id); } catch { return false; } });
                if (validIds.length > 0) {
                    const User = require('../models/User');
                    const users = await User.find({ _id: { $in: validIds } }, { _id: 1, fullName: 1 }).lean();
                    trasherMap = Object.fromEntries(users.map(u => [u._id.toString(), u.fullName]));
                }
            }

            const data = trashedProjects.map(project => {
                const trashedAtDate = new Date(project.trashedAt);
                const daysElapsed = Math.floor((now - trashedAtDate) / (24 * 60 * 60 * 1000));
                const daysUntilPermanentDeletion = Math.max(0, 30 - daysElapsed);
                const trasherName = project.trashedBy ? (trasherMap[project.trashedBy] || 'Unknown') : 'Unknown';
                return {
                    publicId: project.publicId,
                    name: project.name,
                    type: 'project',
                    thumbnail: project.coverImageUrl || null,
                    deletedAt: project.trashedAt,
                    deletedBy: { fullName: trasherName },
                    parentFolder: null,
                    daysUntilPermanentDeletion,
                };
            });

            return res.status(200).json({ success: true, data });
        } catch (error) {
            return serverError(res, 'Failed to load trash');
        }
    }

    async getFavoriteProjects(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const memberships = await ProjectMemberRepository.getFavoriteProjects(userId);
            const projectIds = memberships.map((m) => m.projectId);

            const projects = await Project.find({ publicId: { $in: projectIds } }).select(
                '-_id -updatedAt'
            );

            const membershipMap = new Map(
                memberships.map((membership) => [membership.projectId, membership])
            );

            const data = projects.map((project) => {
                const membership = membershipMap.get(project.publicId);
                return {
                    publicId: project.publicId,
                    name: project.name,
                    description: project.description,
                    industry: project.industry,
                    coverImageUrl: project.coverImageUrl,
                    folderIds: Array.isArray(project.folderIds) ? project.folderIds : [],
                    role: membership?.role || 'member',
                    status: membership?.status || 'accepted',
                    lastVisitedAt: membership?.lastVisitedAt || null,
                    isFavorite: membership?.isFavorite || false,
                };
            });

            return res.status(200).json({
                success: true,
                data,
            });
        } catch (error) {
            return handleServerError(res, 'Failed to load favorite projects');
        }
    }

    async updateIntegrations(req, res) {
        try {
            const normalizedProjectId = normalizeString(req.body?.projectId);
            if (!normalizedProjectId) return badRequest(res, 'projectId is required');

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') return forbidden(res);
            if (!['owner', 'admin'].includes(member.role)) {
                return forbidden(res, 'Only owner or admin can update integrations');
            }

            const { discordWebhook, discordEnabled, slackWebhook, slackEnabled, teamsWebhook, teamsEnabled } = req.body || {};

            const updateFields = {};
            if (discordWebhook !== undefined) updateFields['integrations.discordWebhook'] = discordWebhook || '';
            if (discordEnabled !== undefined) updateFields['integrations.discordEnabled'] = Boolean(discordEnabled);
            if (slackWebhook !== undefined) updateFields['integrations.slackWebhook'] = slackWebhook || '';
            if (slackEnabled !== undefined) updateFields['integrations.slackEnabled'] = Boolean(slackEnabled);
            if (teamsWebhook !== undefined) updateFields['integrations.teamsWebhook'] = teamsWebhook || '';
            if (teamsEnabled !== undefined) updateFields['integrations.teamsEnabled'] = Boolean(teamsEnabled);

            updateFields.updatedAt = new Date();

            const updated = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                { $set: updateFields },
                { returnDocument: 'after', lean: true }
            );
            if (!updated) return notFound(res, 'Project not found');

            return res.status(200).json({
                success: true,
                message: 'Integrations updated',
                data: {
                    integrations: updated.integrations,
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to update integrations');
        }
    }
}

module.exports = new ProjectController();
