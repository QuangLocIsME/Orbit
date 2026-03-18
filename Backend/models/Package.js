const mongoose = require('mongoose');
const crypto = require('crypto');

const PackageSchema = new mongoose.Schema({
    publicId: {
        type: String,
        required: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    packageType: { type: String, default: '', trim: true },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Archived'],
        default: 'Draft',
    },
    dueDate: { type: Date, default: null },
    creatorId: { type: String, required: true, index: true },
    teamMemberIds: [{ type: String }],
    documentIds: [{ type: String }],
    taskIds: [{ type: String }],
    archivedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

PackageSchema.index({ projectId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Package', PackageSchema);
