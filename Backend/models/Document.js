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
    packageId: { type: String, default: null, index: true },
    folderType: {
        type: String,
        enum: ['images', 'files'],
        default: 'files',
        index: true,
    },
    folderPath: { type: String, default: '', trim: true, index: true },

    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    mimeType: { type: String, default: '', trim: true },
    size: { type: Number, default: 0 },

    s3Bucket: { type: String, required: true, index: true },
    s3Key: { type: String, required: true, index: true },
    s3Url: { type: String, default: '', trim: true },

    supabaseFileKey: { type: String, default: '', trim: true },
    supabaseFileUrl: { type: String, default: '', trim: true },

    uploadedBy: { type: String, required: true, index: true },

    versionGroupId: { type: String, default: null, index: true },
    versionNumber: { type: Number, default: 1 },
    uuidv7: { type: String, default: null, index: true },
    conversionStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'NOT_SUPPORTED'],
        default: 'NOT_SUPPORTED',
        index: true,
    },
    xktBucket: { type: String, default: '', trim: true },
    xktKey: { type: String, default: '', trim: true },
    xktUrl: { type: String, default: '', trim: true },
    supabaseIfcKey: { type: String, default: '', trim: true },
    conversionAttempts: { type: Number, default: 0 },
    conversionError: { type: String, default: '' },
    convertedAt: { type: Date, default: null },

    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved',
        index: true,
    },

    _ifcMeta: {
        schema: { type: String, default: '' },
        projectName: { type: String, default: '' },
        creator: { type: String, default: '' },
        fileDescription: { type: String, default: '' },
    },

    versionLabel: { type: String, default: '', trim: true },
    versionDescription: { type: String, default: '', trim: true },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

DocumentSchema.index({ projectId: 1, packageId: 1, folderType: 1, folderPath: 1, createdAt: -1 });

module.exports = mongoose.model('Document', DocumentSchema);

