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

    async listByProjectAndPackage(projectId, packageId) {
        return await DocumentFolder.find({ projectId, packageId }).sort({ folderType: 1, folderPath: 1 });
    }

    async findByPublicId(publicId) {
        return await DocumentFolder.findOne({ publicId });
    }

    async findOneByPath({ projectId, packageId = null, folderPath }) {
        return await DocumentFolder.findOne({
            projectId,
            packageId: { $in: [packageId, packageId === null ? '' : null] },
            folderPath,
        });
    }

    async findSiblings({ projectId, packageId = null, parentPath = '' }) {
        return await DocumentFolder.find({
            projectId,
            packageId: { $in: [packageId, packageId === null ? '' : null] },
            folderPath: new RegExp(`^${parentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+$`),
        });
    }

    async findByIdAndProject(folderId, projectId) {
        return await DocumentFolder.findOne({ publicId: folderId, projectId });
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
            packageId: { $in: [packageId, packageId === null ? '' : null] },
            folderPath: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/)` },
        });
    }

    async deleteByPackageId(packageId) {
        return await DocumentFolder.deleteMany({ packageId });
    }
}

module.exports = new DocumentFolderRepository();
