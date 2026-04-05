const UploadJob = require('../models/UploadJob');

class UploadJobRepository {
    async createJob(data) {
        return await UploadJob.create(data);
    }

    async increaseProgress(jobPublicId, progress) {
        return await UploadJob.findOneAndUpdate(
            { publicId: jobPublicId },
            {
                $set: {
                    progress,
                    updatedAt: new Date(),
                },
            },
            { new: true }
        );
    }

    async findByPublicId(jobPublicId) {
        return await UploadJob.findOne({ publicId: jobPublicId });
    }

    async updateJob(jobPublicId, update) {
        const $set = {
            ...update,
            updatedAt: new Date(),
        };

        return await UploadJob.findOneAndUpdate(
            { publicId: jobPublicId },
            { $set },
            { new: true }
        );
    }
}

module.exports = new UploadJobRepository();

