const mongoose = require('mongoose');
const crypto = require('crypto');

const DocumentFolderSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    projectId: { type: String, required: true, index: true },
    packageId: { type: String, required: true, index: true },
    folderType: {
        type: String,
        enum: ['images', 'files'],
        default: 'files',
        index: true,
    },
    folderPath: { type: String, required: true, trim: true, index: true },
    createdBy: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

DocumentFolderSchema.index({ projectId: 1, packageId: 1, folderType: 1, folderPath: 1 }, { unique: true });

module.exports = mongoose.model('DocumentFolder', DocumentFolderSchema);
