const Project = require('../models/Project');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');

class ProjectController {
    async createProject(req, res) {
        try {
            const { name, description, industry, coverImageUrl } = req.body || {};
            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Project name is required',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const project = await Project.create({
                ownerId: userId,
                name,
                description: description || '',
                industry: industry || '',
                coverImageUrl: coverImageUrl || '',
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Create project failed',
            });
        }
    }

    async getMyProjects(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
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
                    role: membership?.role || 'member',
                    status: membership?.status || 'accepted',
                };
            });

            return res.status(200).json({
                success: true,
                data,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load projects',
            });
        }
    }

    async getProjectMembers(req, res) {
        try {
            const { projectId } = req.body || {};
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) {
                return res.status(403).json({
                    success: false,
                    message: 'Only project members can view member list',
                });
            }

            const members = await ProjectMemberRepository.getMembersByProject(projectId);

            return res.status(200).json({
                success: true,
                data: members,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load project members',
            });
        }
    }

    async updateProject(req, res) {
        try {
            const { projectId, name, description, industry, coverImageUrl } = req.body || {};
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only project admins can update project',
                });
            }

            const updateFields = {
                updatedAt: new Date(),
            };
            if (name !== undefined) updateFields.name = name;
            if (description !== undefined) updateFields.description = description;
            if (industry !== undefined) updateFields.industry = industry;
            if (coverImageUrl !== undefined) updateFields.coverImageUrl = coverImageUrl;

            const project = await Project.findOneAndUpdate(
                { publicId: projectId },
                updateFields,
                { returnDocument: 'after' }
            );

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found',
                });
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Update project failed',
            });
        }
    }

    async deleteProject(req, res) {
        try {
            const { projectId } = req.body || {};
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const project = await Project.findOne({ publicId: projectId });
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found',
                });
            }

            if (project.ownerId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Only project owner can delete project',
                });
            }

            await Project.deleteOne({ publicId: projectId });
            await ProjectMemberRepository.removeMembersByProject(projectId);
            await ProjectInviteRepository.removeByProject(projectId);

            return res.status(200).json({
                success: true,
                message: 'Project deleted',
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Delete project failed',
            });
        }
    }

    async updateMemberRole(req, res) {
        try {
            const { projectId, targetUserId, role } = req.body || {};
            if (!projectId || !targetUserId || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId, targetUserId or role',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only project admins can update roles',
                });
            }

            if (targetUserId === userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Admins cannot change their own role',
                });
            }

            const targetMember = await ProjectMemberRepository.findMember(
                projectId,
                targetUserId
            );
            if (!targetMember) {
                return res.status(404).json({
                    success: false,
                    message: 'Member not found',
                });
            }

            if (targetMember.role === 'admin' && role !== 'admin') {
                const adminCount = await ProjectMemberRepository.countAdmins(projectId);
                if (adminCount <= 1) {
                    return res.status(403).json({
                        success: false,
                        message: 'Cannot downgrade the last admin',
                    });
                }
            }

            const updatedMember = await ProjectMemberRepository.updateMemberRole(
                projectId,
                targetUserId,
                role
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Update member role failed',
            });
        }
    }

    async removeMember(req, res) {
        try {
            const { projectId, targetUserId } = req.body || {};
            if (!projectId || !targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId or targetUserId',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only project admins can remove members',
                });
            }

            if (targetUserId === userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Admins cannot remove themselves',
                });
            }

            const targetMember = await ProjectMemberRepository.findMember(
                projectId,
                targetUserId
            );
            if (!targetMember) {
                return res.status(404).json({
                    success: false,
                    message: 'Member not found',
                });
            }

            if (targetMember.role === 'admin') {
                const adminCount = await ProjectMemberRepository.countAdmins(projectId);
                if (adminCount <= 1) {
                    return res.status(403).json({
                        success: false,
                        message: 'Cannot remove the last admin',
                    });
                }
            }

            await ProjectMemberRepository.removeMember(projectId, targetUserId);

            return res.status(200).json({
                success: true,
                message: 'Member removed',
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Remove member failed',
            });
        }
    }
}

module.exports = new ProjectController();
