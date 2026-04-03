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
}

module.exports = new DocumentFolderRepository();
