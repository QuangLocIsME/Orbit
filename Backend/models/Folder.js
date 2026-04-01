const mongoose = require('mongoose');
const crypto = require('crypto');

const FolderSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    color: { type: String, default: 'blue', trim: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

FolderSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', FolderSchema);
