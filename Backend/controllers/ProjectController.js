const Project = require('../models/Project');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');

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
}

module.exports = new ProjectController();
