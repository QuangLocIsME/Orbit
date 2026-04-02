const mongoose = require('mongoose');

const ProjectInviteSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
        type: String,
        enum: ['admin', 'manager', 'viewer'],
        default: 'viewer',
    },
    tokenHash: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'revoked', 'expired'],
        default: 'pending',
    },
    invitedBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
});

ProjectInviteSchema.index({ projectId: 1, email: 1 }, { unique: true });
ProjectInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProjectInvite', ProjectInviteSchema);
