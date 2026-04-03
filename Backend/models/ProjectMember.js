const mongoose = require('mongoose');

const ProjectMemberSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
        type: String,
        enum: ['admin', 'member', 'viewer'],
        default: 'member',
    },
    status: {
        type: String,
        enum: ['invited', 'accepted', 'blocked'],
        default: 'accepted',
    },
    invitedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
});

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ProjectMember', ProjectMemberSchema);
