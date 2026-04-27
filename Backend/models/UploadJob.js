const mongoose = require('mongoose');
const crypto = require('crypto');

const UploadJobSchema = new mongoose.Schema({
    publicId: {
        type: String,
        required: true,
        index: true,
        unique: true,
        default: () => crypto.randomUUID(),
    },

    projectId: { type: String, required: true, index: true },
    packageId: { type: String, required: true, index: true },
    uploaderId: { type: String, required: true, index: true },

    fileOriginalName: { type: String, required: true, trim: true },
    mimeType: { type: String, default: '', trim: true },
    size: { type: Number, default: 0 },

    tempFilePath: { type: String, required: true, trim: true },

    s3Bucket: { type: String, required: true },
    s3Key: { type: String, required: true },
    folderType: { type: String, default: 'files' },
    folderPath: { type: String, default: '' },
    storageProvider: { type: String, default: 's3' },
    storageEndpoint: { type: String, default: '' },

    // Versioning fields
    versionGroupId: { type: String, default: null },
    versionNumber: { type: Number, default: 1 },
    versionLabel: { type: String, default: '' },
    versionDescription: { type: String, default: '' },
    isNewVersion: { type: Boolean, default: false },

    // uuidv7 for time-ordered file naming and version sorting
    uuidv7: { type: String, default: null },

    // Supabase storage path for queued uploads
    supaFilePath: { type: String, default: '' },

    status: {
        type: String,
        enum: ['queued', 'processing', 'completed', 'failed'],
        default: 'queued',
        index: true,
    },
    progress: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },

    documentPublicId: { type: String, default: null, index: true },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

UploadJobSchema.index({ projectId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('UploadJob', UploadJobSchema);

