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
            { new: true }
        );
    }

    async updateConversionStateByPublicId(publicId, update = {}) {
        return await Document.findOneAndUpdate(
            { publicId },
            {
                ...update,
                updatedAt: new Date(),
            },
            { new: true }
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
}

module.exports = new DocumentRepository();

