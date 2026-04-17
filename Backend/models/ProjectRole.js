const mongoose = require('mongoose');
const crypto = require('crypto');

const ProjectRoleSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    color: {
        type: String,
        default: '#6366F1',
    },
    accessLevel: {
        type: String,
        enum: ['full', 'high', 'medium', 'minimal'],
        default: 'medium',
    },
    isSystem: {
        type: Boolean,
        default: false,
    },
    // roleKey dùng để map với ProjectMember.role (admin, member, viewer, owner)
    roleKey: {
        type: String,
        default: null,
    },
    permissions: {
        type: [String],
        default: [],
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

// Compound index for unique role names per project
ProjectRoleSchema.index({ projectId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ProjectRole', ProjectRoleSchema);
