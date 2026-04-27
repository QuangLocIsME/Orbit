const Document = require('../models/Document');

class DocumentRepository {
    async createDocument(data) {
        return await Document.create(data);
    }

    async countByVersionGroupId(versionGroupId) {
        return await Document.countDocuments({ versionGroupId });
    }

    async findByPublicId(documentPublicId) {
        return await Document.findOne({ publicId: documentPublicId });
    }

    async findByPublicIds(documentPublicIds) {
        if (!documentPublicIds || documentPublicIds.length === 0) return [];
        return await Document.find({ publicId: { $in: documentPublicIds } }).lean();
    }

    async findLatestInVersionGroup(versionGroupId) {
        return await Document.findOne({ versionGroupId }).sort({ versionNumber: -1, createdAt: -1 });
    }

    async listByProject(projectId) {
        return await Document.find({ projectId }).sort({ createdAt: -1 });
    }

    async listByProjectAndPackage(projectId, packageId) {
        return await Document.find({ projectId, packageId }).sort({ createdAt: -1 });
    }

    async updateNameByPublicId(publicId, originalName) {
        return await Document.findOneAndUpdate(
            { publicId },
            { originalName, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async deleteByPublicId(publicId) {
        return await Document.findOneAndDelete({ publicId });
    }

    async listByProjectPackageAndPath({ projectId, packageId = null, folderPath = '' }) {
        return await Document.find({ projectId, packageId, folderPath });
    }

    async renameFolderPath({ projectId, packageId = null, oldPrefix, newPrefix }) {
        const docs = await Document.find({
            projectId,
            packageId,
            folderPath: { $regex: `^${oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/)` },
        });

        for (const doc of docs) {
            const nextPath = doc.folderPath === oldPrefix
                ? newPrefix
                : doc.folderPath.replace(`${oldPrefix}/`, `${newPrefix}/`);
            doc.folderPath = nextPath;
            doc.updatedAt = new Date();
            await doc.save();
        }

        return docs.length;
    }

    async deleteByFolderPathPrefix({ projectId, packageId = null, pathPrefix }) {
        return await Document.deleteMany({
            projectId,
            packageId: { $in: [packageId, packageId === null ? '' : null] },
            folderPath: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/)` },
        });
    }

    async deleteByPackageId(packageId) {
        return await Document.deleteMany({ packageId });
    }

    async listIfcByProject(projectId) {
        return await Document.find({
            projectId,
            originalName: { $regex: /\.ifc$/i },
        }).sort({ createdAt: -1 });
    }

    async countVersionsByVersionGroupIds(versionGroupIds) {
        if (!versionGroupIds || versionGroupIds.length === 0) return new Map();
        const agg = await Document.aggregate([
            { $match: { versionGroupId: { $in: versionGroupIds } } },
            { $group: { _id: '$versionGroupId', count: { $sum: 1 } } },
        ]);
        return new Map(agg.map((r) => [r._id, r.count]));
    }

    async updateApprovalStatus(publicId, approvalStatus) {
        return await Document.findOneAndUpdate(
            { publicId },
            { approvalStatus, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async updateConversionStateByPublicId(publicId, update) {
        return await Document.findOneAndUpdate(
            { publicId },
            {
                $set: {
                    ...update,
                    updatedAt: new Date(),
                },
            },
            { returnDocument: 'after' }
        );
    }

    async listApprovedByProjectAndPackage(projectId, packageId) {
        return await Document.find({
            projectId,
            packageId,
            approvalStatus: 'approved',
        }).sort({ createdAt: -1 });
    }

    async listApprovedByProject(projectId) {
        return await Document.find({
            projectId,
            approvalStatus: 'approved',
        }).sort({ createdAt: -1 });
    }
}

module.exports = new DocumentRepository();

