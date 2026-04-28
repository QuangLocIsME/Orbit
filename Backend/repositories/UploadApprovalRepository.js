const UploadApproval = require('../models/UploadApproval');

class UploadApprovalRepository {
    async create(data) {
        return await UploadApproval.create(data);
    }

    async findByPublicId(publicId) {
        return await UploadApproval.findOne({ publicId });
    }

    async findByDocumentId(documentId) {
        return await UploadApproval.findOne({ documentId });
    }

    async findPendingByProject(projectId) {
        return await UploadApproval.find({ projectId, status: 'pending' })
            .sort({ createdAt: -1 });
    }

    async findByProject(projectId, { status } = {}) {
        const query = { projectId };
        if (status) query.status = status;
        return await UploadApproval.find(query).sort({ createdAt: -1 });
    }

    async countPendingByProject(projectId) {
        return await UploadApproval.countDocuments({ projectId, status: 'pending' });
    }

    async approve(publicId, reviewedBy) {
        return await UploadApproval.findOneAndUpdate(
            { publicId },
            {
                $set: {
                    status: 'approved',
                    reviewedBy,
                    reviewedAt: new Date(),
                    approvedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
            { returnDocument: 'after' }
        );
    }

    async reject(publicId, reviewedBy, reason = '') {
        return await UploadApproval.findOneAndUpdate(
            { publicId },
            {
                $set: {
                    status: 'rejected',
                    reviewedBy,
                    reviewedAt: new Date(),
                    rejectionReason: reason,
                    updatedAt: new Date(),
                },
            },
            { returnDocument: 'after' }
        );
    }

    async deleteByPublicId(publicId) {
        return await UploadApproval.findOneAndDelete({ publicId });
    }

    async deleteByDocumentId(documentId) {
        return await UploadApproval.deleteMany({ documentId });
    }

    async deleteByProjectId(projectId) {
        return await UploadApproval.deleteMany({ projectId });
    }
}

module.exports = new UploadApprovalRepository();
