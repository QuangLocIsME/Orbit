const mongoose = require('mongoose');
const crypto = require('crypto');

const ProjectMemberSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true }, // User's publicId
    role: {
        type: String,
        enum: ['owner', 'admin', 'manager', 'member', 'viewer'],
        default: 'member',
    },
    status: {
        type: String,
        enum: ['invited', 'accepted', 'blocked'],
        default: 'accepted',
    },
    invitedBy: { type: String, default: null },
    lastVisitedAt: { type: Date, default: null, index: true },
    isFavorite: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    createdAt: { type: Date, default: Date.now },
});

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ProjectMember', ProjectMemberSchema);
