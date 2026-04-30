const CRVersion = require('../models/CRVersion');

class CRVersionRepository {
    async create(data) {
        const version = new CRVersion(data);
        return await version.save();
    }

    async findByPublicId(publicId) {
        return await CRVersion.findOne({ publicId });
    }

    async listByCrId(crId) {
        return await CRVersion.find({ crId })
            .sort({ versionNumber: -1 })
            .lean();
    }

    async listByProject(projectId) {
        return await CRVersion.find({ projectId })
            .sort({ createdAt: -1 })
            .lean();
    }

    async addResultFile(publicId, fileData) {
        return await CRVersion.findOneAndUpdate(
            { publicId },
            { $push: { resultFiles: fileData } },
            { returnDocument: 'after' }
        );
    }

    async updateStatus(publicId, status, reviewedBy) {
        return await CRVersion.findOneAndUpdate(
            { publicId },
            {
                $set: {
                    status,
                    reviewedBy,
                    reviewedAt: new Date(),
                },
            },
            { returnDocument: 'after' }
        );
    }
}

module.exports = new CRVersionRepository();
