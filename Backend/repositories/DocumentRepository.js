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

    async listByProjectAndFolder({ projectId, folderType, folderPath = '' }) {
        const query = { projectId };
        if (folderType) query.folderType = folderType;
        if (typeof folderPath === 'string') query.folderPath = folderPath;

        return await Document.find(query).sort({ createdAt: -1 });
    }
}

module.exports = new DocumentRepository();

