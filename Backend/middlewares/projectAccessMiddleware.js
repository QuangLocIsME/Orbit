const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');

const LEGACY_NAVISWORKS_PROJECTS = path.resolve(__dirname, '..', 'data', 'navisworks', 'projects');

/**
 * Sau authenticate: nếu có workspace trên disk (data/navisworks/projects/<id>/workspace.json)
 * thì cho phép (test clash trước khi map project Mongo). Ngược lại: publicId Mongo + member.
 */
const requireProjectMember = (paramName = 'projectSlug') => async (req, res, next) => {
    try {
        const projectPublicId = req.params[paramName];
        if (!projectPublicId || typeof projectPublicId !== 'string') {
            return res.status(400).json({ success: false, message: 'Missing project identifier' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const wp = path.join(LEGACY_NAVISWORKS_PROJECTS, projectPublicId, 'workspace.json');
        if (fs.existsSync(wp)) {
            return next();
        }

        const project = await Project.findOne({ publicId: projectPublicId }).select('publicId').lean();
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const member = await ProjectMemberRepository.findMember(projectPublicId, userId);
        if (!member) {
            return res.status(403).json({ success: false, message: 'Not a member of this project' });
        }

        return next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Project access check failed' });
    }
};

module.exports = {
    requireProjectMember,
};
