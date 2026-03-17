const Package = require('../models/Package');
const Project = require('../models/Project');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');

/**
 * Use Case UC-PKG-001: Create New Package (Table 25)
 */
async function createPackage(req, res) {
    try {
        const { projectId, name, description, type, dueDate, teamMemberIds } = req.body || {};

        if (!projectId || !name) {
            return res.status(400).json({
                success: false,
                message: 'projectId and name are required',
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

        const member = await ProjectMemberRepository.findMember(projectId, userId);
        if (!member || member.status !== 'accepted') {
            return res.status(403).json({
                success: false,
                message: 'Only project members can create packages',
            });
        }
        if (member.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Viewers do not have package management permission',
            });
        }

        const existing = await Package.findOne({ projectId, name: name.trim() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A package with this name already exists in the project. Please use a unique name.',
            });
        }

        const packageDoc = await Package.create({
            projectId,
            name: name.trim(),
            description: description != null ? String(description).trim() : '',
            packageType: type != null ? String(type).trim() : '',
            status: 'Draft',
            dueDate: dueDate ? new Date(dueDate) : null,
            creatorId: userId,
            teamMemberIds: Array.isArray(teamMemberIds) ? teamMemberIds : [],
            documentIds: [],
            taskIds: [],
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
                createdAt: packageDoc.createdAt,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A package with this name already exists in the project. Please use a unique name.',
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || 'Create package failed',
        });
    }
}

async function getPackagesByProject(req, res) {
    try {
        const { projectId } = req.body || req.query || {};

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'projectId is required',
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
        if (!member || member.status !== 'accepted') {
            return res.status(403).json({
                success: false,
                message: 'Only project members can view packages',
            });
        }

        const packages = await Package.find({ projectId })
            .select('-_id -__v')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: packages,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to load packages',
        });
    }
}

module.exports = {
    createPackage,
    getPackagesByProject,
};
