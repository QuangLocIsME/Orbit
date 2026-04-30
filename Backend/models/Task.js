const mongoose = require('mongoose');
const crypto = require('crypto');

const TaskSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    projectId: { type: String, required: true, index: true },
    packageId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, default: 'backlog', trim: true },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    },
    // Single assignee (backward-compatible)
    assigneeId: { type: String, default: '', index: true },
    // Multi assignee
    assigneeIds: { type: [String], default: [], index: true },
    // Reviewers (can move task stage)
    reviewerIds: { type: [String], default: [], index: true },
    dueDate: { type: Date, default: null },
    linkedUrl: { type: String, default: '', trim: true },
    affectedModels: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    commentsCount: { type: Number, default: 0 },
    attachmentsCount: { type: Number, default: 0 },
    attachments: {
        type: [{
            name:    { type: String, required: true },
            size:    { type: Number, required: true },
            url:     { type: String, required: true },
            mimeType: { type: String, default: '' },
            uploadedAt: { type: Date, default: Date.now },
        }],
        default: [],
    },
    createdBy: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

TaskSchema.index({ projectId: 1, packageId: 1, createdAt: -1 });

module.exports = mongoose.model('Task', TaskSchema);
