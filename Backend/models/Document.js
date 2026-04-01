const mongoose = require('mongoose');
const crypto = require('crypto');

const DocumentSchema = new mongoose.Schema({
    publicId: {
        type: String,
        required: true,
        index: true,
        unique: true,
        default: () => crypto.randomUUID(),
    },
    projectId: { type: String, required: true, index: true },
    packageId: { type: String, required: true, index: true },

    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    mimeType: { type: String, default: '', trim: true },
    size: { type: Number, default: 0 },

    s3Bucket: { type: String, required: true, index: true },
    s3Key: { type: String, required: true, index: true },
    s3Url: { type: String, default: '', trim: true },

    uploadedBy: { type: String, required: true, index: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

DocumentSchema.index({ projectId: 1, packageId: 1, createdAt: -1 });

module.exports = mongoose.model('Document', DocumentSchema);

