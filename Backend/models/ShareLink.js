const mongoose = require('mongoose');

const ShareLinkSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    packageIds: { type: [String], default: [] },
    teamIds: { type: [String], default: [] },
    tokenHash: { type: String, required: true, unique: true },
    shareUrl: { type: String, required: true },
    label: { type: String, default: '' },
    shareType: {
        type: String,
        enum: ['project', 'packages', 'team'],
        default: 'packages',
    },
    allowedRoles: {
        type: [String],
        enum: ['guest', 'viewer', 'member', 'contractor'],
        default: ['guest'],
    },
    allowedPages: {
        type: [String],
        default: ['overview', 'documents', 'tasks'],
    },
    allowedTeamIds: {
        type: [String],
        default: [],
    },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
});

ShareLinkSchema.index({ projectId: 1, shareType: 1 });
ShareLinkSchema.index({ tokenHash: 1 }, { unique: true });
ShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ShareLink', ShareLinkSchema);
