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
    packageId: { type: String, default: null, index: true },
    folderType: {
        type: String,
        enum: ['images', 'files'],
        default: 'files',
        index: true,
    },
    // '' = root of the group, 'sub' = direct child, 'sub/deep' = nested
    folderPath: { type: String, default: '', trim: true, index: true },
    createdBy: { type: String, default: null, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

DocumentFolderSchema.index({ projectId: 1, packageId: 1, folderType: 1, folderPath: 1 }, { unique: true });

module.exports = mongoose.model('DocumentFolder', DocumentFolderSchema);
