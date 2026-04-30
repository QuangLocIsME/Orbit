const mongoose = require('mongoose');

const JoinRequestSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    requestedBy: { type: String, required: true },
    requestedByEmail: { type: String, required: true, lowercase: true, trim: true },
    requestedByName: { type: String, default: '' },
    role: {
        type: String,
        enum: ['member', 'contractor', 'viewer'],
        default: 'member',
    },
    message: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});

JoinRequestSchema.index({ projectId: 1, requestedByEmail: 1 });
JoinRequestSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('JoinRequest', JoinRequestSchema);
