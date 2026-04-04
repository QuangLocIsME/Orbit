const mongoose = require('mongoose');
const crypto = require('crypto');

const ProjectSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    industry: { type: String, default: '', trim: true },
    coverImageUrl: { type: String, default: '', trim: true },
    folderIds: { type: [String], default: [], index: true },
    workflow: {
        template: { type: String, default: 'construction-standard' },
        stages: {
            type: [
                {
                    id: { type: String, required: true },
                    label: { type: String, required: true },
                },
            ],
            default: [
                { id: 'backlog', label: 'Backlog' },
                { id: 'todo', label: 'To Do' },
                { id: 'in-progress', label: 'In Progress' },
                { id: 'review', label: 'Review' },
                { id: 'done', label: 'Done' },
            ],
        },
        settings: {
            autoAssignTasks: { type: Boolean, default: false },
            notifyOnStatusChange: { type: Boolean, default: true },
            requireApprovalForCompletion: { type: Boolean, default: false },
        },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', ProjectSchema);
