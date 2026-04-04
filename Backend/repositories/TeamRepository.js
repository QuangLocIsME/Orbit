const Team = require('../models/Team');

class TeamRepository {
    async create({ projectId, name, description, color, createdBy }) {
        return await Team.create({ projectId, name, description, color, createdBy });
    }

    async findByProject(projectId) {
        return await Team.find({ projectId }).lean();
    }

    async findByPublicId(publicId) {
        return await Team.findOne({ publicId }).lean();
    }

    async deleteByPublicId(publicId) {
        return await Team.deleteOne({ publicId });
    }

    async deleteByProject(projectId) {
        return await Team.deleteMany({ projectId });
    }
}

module.exports = new TeamRepository();
