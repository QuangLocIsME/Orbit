const mongoose = require('mongoose');
const crypto = require('crypto');

const UploadApprovalSchema = new mongoose.Schema({
    publicId: {
        type: String,
        required: true,
        index: true,
        unique: true,
        default: () => crypto.randomUUID(),
    },

    projectId: {
        type: String,
        required: true,
        index: true,
    },

    documentId: {
        type: String,
        required: true,
        index: true,
    },

    jobId: {
        type: String,
        default: null,
        index: true,
    },

    uploaderId: {
        type: String,
        required: true,
        index: true,
    },

    originalName: {
        type: String,
        required: true,
        trim: true,
    },

    mimeType: {
        type: String,
        default: '',
    },

    size: {
        type: Number,
        default: 0,
    },

    folderType: {
        type: String,
        enum: ['images', 'files'],
        default: 'files',
    },

    folderPath: {
        type: String,
        default: '',
    },

    versionGroupId: {
        type: String,
        default: null,
    },

    versionNumber: {
        type: Number,
        default: 1,
    },

    versionLabel: {
        type: String,
        required: true,
        trim: true,
    },

    versionDescription: {
        type: String,
        default: '',
        trim: true,
    },

    isNewVersion: {
        type: Boolean,
        default: false,
    },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true,
    },

    reviewedBy: {
        type: String,
        default: null,
    },

    reviewedAt: {
        type: Date,
        default: null,
    },

    rejectionReason: {
        type: String,
        default: '',
        trim: true,
    },

    approvedAt: {
        type: Date,
        default: null,
    },

    fileUrl: {
        type: String,
        default: '',
    },

    s3Key: {
        type: String,
        default: '',
    },

    supabaseFileKey: {
        type: String,
        default: '',
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },

    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

UploadApprovalSchema.index({ projectId: 1, status: 1, createdAt: -1 });
UploadApprovalSchema.index({ uploaderId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('UploadApproval', UploadApprovalSchema);
