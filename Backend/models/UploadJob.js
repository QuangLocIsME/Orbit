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

    folderType: {
        type: String,
        enum: ['images', 'files'],
        default: 'files',
        index: true,
    },
    folderPath: { type: String, default: '', trim: true },

    tempFilePath: { type: String, required: true, trim: true },

    s3Bucket: { type: String, required: true },
    s3Key: { type: String, required: true },
    storageProvider: {
        type: String,
        enum: ['supabase-s3', 'aws-s3', 'minio', 'local'],
        default: 'supabase-s3',
    },
    storageEndpoint: { type: String, default: '', trim: true },

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

