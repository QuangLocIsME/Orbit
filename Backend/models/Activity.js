const mongoose = require('mongoose');
const crypto = require('crypto');

const ActivitySchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    projectId: { type: String, required: true, index: true },
    packageId: { type: String, default: null, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: '' },
    type: {
        type: String,
        required: true,
        enum: [
            'task_created',
            'task_updated',
            'task_deleted',
            'task_moved',
            'task_commented',
            'folder_created',
            'folder_renamed',
            'folder_deleted',
            'file_uploaded',
            'file_version_uploaded',
            'file_renamed',
            'file_deleted',
            'upload_approved',
            'upload_rejected',
        ],
        index: true,
    },
    targetId: { type: String, default: null },
    targetName: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
});

ActivitySchema.index({ projectId: 1, packageId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);
