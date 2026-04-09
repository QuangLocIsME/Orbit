const ChangeRequest = require('../models/ChangeRequest');

class ChangeRequestRepository {
    async create(data) {
        const changeRequest = new ChangeRequest(data);
        return await changeRequest.save();
    }

    async findByPublicId(publicId) {
        return await ChangeRequest.findOne({ publicId });
    }

    async listByProject(projectId) {
        return await ChangeRequest.find({ projectId })
            .sort({ createdAt: -1 })
            .lean();
    }

    async updateStatus(publicId, status) {
        return await ChangeRequest.findOneAndUpdate(
            { publicId },
            { status, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async update(publicId, updates) {
        return await ChangeRequest.findOneAndUpdate(
            { publicId },
            { ...updates, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async delete(publicId) {
        return await ChangeRequest.deleteOne({ publicId });
    }

    async countByProject(projectId) {
        return await ChangeRequest.countDocuments({ projectId });
    }
}

module.exports = new ChangeRequestRepository();
