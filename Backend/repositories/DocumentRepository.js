const Document = require('../models/Document');

class DocumentRepository {
    async createDocument(data) {
        return await Document.create(data);
    }

    async findByPublicId(documentPublicId) {
        return await Document.findOne({ publicId: documentPublicId });
    }

    async listByProject(projectId) {
        return await Document.find({ projectId }).sort({ createdAt: -1 });
    }

    async updateNameByPublicId(publicId, originalName) {
        return await Document.findOneAndUpdate(
            { publicId },
            { originalName, updatedAt: new Date() },
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
            packageId,
            folderPath: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/)` },
        });
    }
}

module.exports = new DocumentRepository();

