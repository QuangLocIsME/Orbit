const Project = require('../models/Project');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');
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

            return res.status(201).json({
                success: true,
                message: 'Project created',
                data: {
                    publicId: project.publicId,
                    name: project.name,
                    description: project.description,
                    industry: project.industry,
                    coverImageUrl: project.coverImageUrl,
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
                    role: membership?.role || 'member',
                    status: membership?.status || 'accepted',
                };
            });

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

            const members = await ProjectMemberRepository.getMembersByProject(normalizedProjectId);

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

            return res.status(200).json({
                success: true,
                message: 'Project deleted',
            });
        } catch (error) {
            return serverError(res, 'Delete project failed');
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
            const { projectId, targetUserId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedTargetUserId = normalizeString(targetUserId);
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

            return res.status(200).json({
                success: true,
                message: 'Member removed',
            });
        } catch (error) {
            return handleServerError(res, 'Remove member failed');
        }
    }
}

module.exports = new ProjectController();
