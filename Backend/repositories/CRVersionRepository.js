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

    async updateStatus(publicId, status, reviewedBy, rejectionReason = '') {
        const set = {
            status,
            reviewedBy,
            reviewedAt: new Date(),
        };
        if (status === 'rejected') set.rejectionReason = rejectionReason;
        if (status === 'approved') set.rejectionReason = '';

        return await CRVersion.findOneAndUpdate(
            { publicId },
            {
                $set: set,
            },
            { returnDocument: 'after' }
        );
    }

    async updateResultFiles(publicId, resultFiles) {
        return await CRVersion.findOneAndUpdate(
            { publicId },
            { $set: { resultFiles } },
            { returnDocument: 'after' }
        );
    }
}

module.exports = new CRVersionRepository();
