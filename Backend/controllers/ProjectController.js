const Project = require('../models/Project');
const Folder = require('../models/Folder');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');
const { getJson, setJson, delKeys } = require('../services/cacheService');
const socketService = require('../services/socketService');
const { invalidateUserCache } = socketService;
const { normalizeString } = require('../utils/sanitize');
const { errorResponse } = require('../utils/response');

const getNormalizedProjectId = (req) => normalizeString(req.body?.projectId);

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res) => errorResponse(res, 403, 'Forbidden');
const notFound = (res, message) => errorResponse(res, 404, message);
const serverError = (res, message) => errorResponse(res, 500, message);
const handleBadRequest = (res, message) => badRequest(res, message);
const handleServerError = (res, message) => serverError(res, message);

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
        { id: 'backlog', label: 'Backlog' },
        { id: 'todo', label: 'To Do' },
        { id: 'in-progress', label: 'In Progress' },
        { id: 'review', label: 'Review' },
        { id: 'done', label: 'Done' },
    ],
    'agile-scrum': [
        { id: 'product-backlog', label: 'Product Backlog' },
        { id: 'sprint-backlog', label: 'Sprint Backlog' },
        { id: 'in-progress', label: 'In Progress' },
        { id: 'testing', label: 'Testing' },
        { id: 'review', label: 'Review' },
        { id: 'done', label: 'Done' },
    ],
    'design-review': [
        { id: 'draft', label: 'Draft' },
        { id: 'review', label: 'Review' },
        { id: 'revision', label: 'Revision' },
        { id: 'approved', label: 'Approved' },
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

            const project = await Project.create({
                ownerId: userId,
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
                role: 'admin',
                status: 'accepted',
                invitedBy: null,
            });

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
            const cachedData = await getJson(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    data: cachedData,
                    cached: true,
                });
            }

            const memberships = await ProjectMemberRepository.getProjectsByUser(userId);
            const projectIds = memberships.map((membership) => membership.projectId);

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

            // Collect unique userIds to batch-fetch user profiles (userId = MongoDB _id ObjectId)
            const userIds = [...new Set(rawMembers.map((m) => m.userId).filter(Boolean))];
            const { Types } = require('mongoose');
            const validObjectIds = userIds.filter((id) => /^[a-f\d]{24}$/i.test(id));
            const userDocs = validObjectIds.length
                ? await require('../models/User').find({ _id: { $in: validObjectIds.map((id) => new Types.ObjectId(id)) } }).select('_id fullName email avatar').lean()
                : [];
            const userMap = new Map(userDocs.map((u) => [String(u._id), u]));

            const members = rawMembers.map((m) => ({
                publicId: String(m._id),
                userId: m.userId,
                role: m.role,
                status: m.status,
                invitedBy: m.invitedBy,
                createdAt: m.createdAt,
                user: m.userId ? (() => {
                    const u = userMap.get(m.userId);
                    return u ? { fullName: u.fullName, email: u.email, avatar: u.avatar } : null;
                })() : null,
            }));

            return res.status(200).json({
                success: true,
                data: members,
            });
        } catch (error) {
            return handleServerError(res, 'Failed to load project members');
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
            if (!member || member.role !== 'admin') {
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
            if (!member || member.role !== 'admin') {
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

            if (targetMember.role === 'admin' && role !== 'admin') {
                const adminCount = await ProjectMemberRepository.countAdmins(normalizedProjectId);
                if (adminCount <= 1) {
                    return forbidden(res);
                }
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
            if (!member || member.role !== 'admin') {
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

            if (targetMember.role === 'admin') {
                const adminCount = await ProjectMemberRepository.countAdmins(normalizedProjectId);
                if (adminCount <= 1) {
                    return errorResponse(res, 403, 'Forbidden');
                }
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

            const project = await Project.findOne({ publicId: normalizedProjectId }).select('publicId workflow');
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

            return res.status(200).json({
                success: true,
                data: { template, stages, settings },
            });
        } catch (error) {
            return handleServerError(res, 'Failed to load workflow');
        }
    }

    async updateWorkflow(req, res) {
        try {
            const normalizedProjectId = getNormalizedProjectId(req);
            const { template, stages, settings } = req.body || {};
            if (!normalizedProjectId) {
                return badRequest(res, 'Missing projectId');
            }

            const userId = requireUserId(req, res);
            if (!userId) return;

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.role !== 'admin') return forbidden(res);

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

            const project = await Project.findOneAndUpdate(
                { publicId: normalizedProjectId },
                {
                    workflow: {
                        template: nextTemplate,
                        stages: nextStages,
                        settings: nextSettings,
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
}

module.exports = new ProjectController();
