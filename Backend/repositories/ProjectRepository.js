const Project = require('../models/Project');

class ProjectRepository {
    async findByPublicId(publicId) {
        return await Project.findOne({ publicId });
    }
}

module.exports = new ProjectRepository();