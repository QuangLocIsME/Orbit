const mongoose = require('mongoose');
const crypto = require('crypto');

const ProjectSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    // ownerId = user's publicId (UUID) - người tạo project
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    industry: { type: String, default: '', trim: true },
    coverImageUrl: { type: String, default: '', trim: true },
    avatarStoragePath: { type: String, default: null },
    folderIds: { type: [String], default: [], index: true },
    workflowTemplateId: { type: String, default: null, index: true },
    workflow: {
        template: { type: String, default: '' },
        stages: {
            type: [
                {
                    id: { type: String, required: true },
                    label: { type: String, required: true },
                    color: { type: String, default: '#6A7280' },
                },
            ],
            default: [],
        },
        settings: {
            autoAssignTasks: { type: Boolean, default: false },
            notifyOnStatusChange: { type: Boolean, default: true },
            requireApprovalForCompletion: { type: Boolean, default: false },
        },
        taskTags: {
            type: [
                {
                    id: { type: String, required: true },
                    name: { type: String, required: true },
                    description: { type: String, default: '' },
                    color: { type: String, default: '#6366F1' },
                },
            ],
            default: [],
        },
    },
    integrations: {
        discordWebhook: { type: String, default: '' },
        slackWebhook: { type: String, default: '' },
        teamsWebhook: { type: String, default: '' },
        discordEnabled: { type: Boolean, default: false },
        slackEnabled: { type: Boolean, default: false },
        teamsEnabled: { type: Boolean, default: false },
    },
    trashedAt: { type: Date, default: null },
    trashedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', ProjectSchema);
