const Document = require('../models/Document');

class DocumentRepository {
    async createDocument(data) {
        return await Document.create(data);
    }

    async findByPublicId(documentPublicId) {
        return await Document.findOne({ publicId: documentPublicId });
    }
}

module.exports = new DocumentRepository();

