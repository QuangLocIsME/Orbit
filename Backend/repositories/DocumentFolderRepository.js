const DocumentFolder = require('../models/DocumentFolder');

class DocumentFolderRepository {
    async createFolder(data) {
        return await DocumentFolder.create(data);
    }

    async findByProjectAndPath({ projectId, packageId, folderType, folderPath }) {
        return await DocumentFolder.findOne({ projectId, packageId, folderType, folderPath });
    }

    async listByProject(projectId) {
        return await DocumentFolder.find({ projectId }).sort({ packageId: 1, folderType: 1, folderPath: 1 });
    }

    async findByPublicId(publicId) {
        return await DocumentFolder.findOne({ publicId });
    }

    async deleteByPublicId(publicId) {
        return await DocumentFolder.findOneAndDelete({ publicId });
    }

    async renamePathPrefix({ projectId, packageId = null, oldPrefix, newPrefix }) {
        const folders = await DocumentFolder.find({
            projectId,
            packageId,
            folderPath: { $regex: `^${oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/)` },
        });

        for (const folder of folders) {
            const nextPath = folder.folderPath === oldPrefix
                ? newPrefix
                : folder.folderPath.replace(`${oldPrefix}/`, `${newPrefix}/`);
            folder.folderPath = nextPath;
            folder.updatedAt = new Date();
            await folder.save();
        }

        return folders.length;
    }

    async deleteByPathPrefix({ projectId, packageId = null, pathPrefix }) {
        return await DocumentFolder.deleteMany({
            projectId,
            packageId,
            folderPath: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/)` },
        });
    }
}

module.exports = new DocumentFolderRepository();
