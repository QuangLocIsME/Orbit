const mongoose = require('mongoose');
const crypto = require('crypto');

const ChangeRequestSchema = new mongoose.Schema({
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
    crId: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'approved', 'completed', 'rejected'],
        default: 'pending',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    },
    affectedModels: {
        type: [String],
        default: [],
    },
    disciplineId: {
        type: String,
        default: null,
        index: true,
    },
    assignedTo: {
        type: [String],
        default: [],
    },
    reviewers: {
        type: [String],
        default: [],
    },
    attachments: {
        type: [
            {
                name: { type: String, default: '' },
                size: { type: Number, default: 0 },
                url: { type: String, default: '' },
                mimeType: { type: String, default: '' },
            },
        ],
        default: [],
    },
    estimatedImpact: {
        type: String,
        enum: ['low', 'medium', 'high', null],
        default: null,
    },
    estimatedCost: {
        type: Number,
        default: null,
    },
    estimatedDuration: {
        type: String,
        default: '',
        trim: true,
    },
    deadline: {
        type: Date,
        default: null,
    },
    detailedDescription: {
        type: String,
        default: '',
        trim: true,
    },
    createdBy: {
        type: String,
        required: true,
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

ChangeRequestSchema.index({ projectId: 1, createdAt: -1 });
ChangeRequestSchema.index({ projectId: 1, status: 1 });

// Set crId before validation runs (Mongoose 9: pre validate runs before validation)
ChangeRequestSchema.pre('validate', async function () {
    if (this.isNew && !this.crId) {
        const count = await mongoose.model('ChangeRequest').countDocuments({ projectId: this.projectId });
        this.crId = `CR-${String(count + 1).padStart(3, '0')}`;
    }
});

ChangeRequestSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('ChangeRequest', ChangeRequestSchema);
