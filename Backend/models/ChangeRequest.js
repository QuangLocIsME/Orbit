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
        enum: ['pending', 'in-progress', 'approved', 'completed', 'published', 'rejected'],
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
    // ── Task linking (execution layer) ──────────────────────────────────────────
    linkedTaskIds: {
        type: [String],
        default: [],
        index: true,
    },
    primaryTaskId: {
        type: String,
        default: null,
        index: true,
    },
    // ── Document linking (file layer) ─────────────────────────────────────────
    affectedDocuments: {
        type: [String],
        default: [],
        index: true,
    },
    derivedPackageIds: {
        type: [String],
        default: [],
    },
    // ── Structured sections ────────────────────────────────────────────────────
    structuredSections: {
        type: {
            context:          { type: String, default: '' },
            problem:          { type: String, default: '' },
            proposedChange:   { type: String, default: '' },
            impact: {
                estimatedImpact:       { type: String, enum: ['low', 'medium', 'high', null], default: null },
                affectedModels:       [{ type: String, default: '' }],
                clashCheckRequired:   { type: Boolean, default: false },
            },
        },
        default: null,
    },
    // ── Result attachments (uploaded after CR completion) ───────────────────────
    resultAttachments: {
        type: [{
            name:              { type: String, default: '' },
            size:              { type: Number, default: 0 },
            url:               { type: String, default: '' },
            mimeType:          { type: String, default: '' },
            sourceDocumentId:  { type: String, default: '' },
        }],
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

ChangeRequestSchema.index({ projectId: 1, createdAt: -1 });
ChangeRequestSchema.index({ projectId: 1, status: 1 });
ChangeRequestSchema.index({ linkedTaskIds: 1 });
ChangeRequestSchema.index({ primaryTaskId: 1 });

// Set crId before validation runs (Mongoose 9: pre validate runs before validation)
ChangeRequestSchema.pre('validate', async function () {
    if (this.isNew && !this.crId) {
        const count = await mongoose.model('ChangeRequest').countDocuments({ projectId: this.projectId });
        this.crId = `CR-${String(count + 1).padStart(3, '0')}`;
    }
});

ChangeRequestSchema.pre('save', async function () {
    this.updatedAt = new Date();
    if (this.isModified('affectedDocuments')) {
        try {
            const Document = mongoose.model('Document');
            const docs = await Document.find({ publicId: { $in: this.affectedDocuments } }).select('packageId').lean();
            this.derivedPackageIds = [...new Set(docs.map(d => d.packageId).filter(Boolean))];
        } catch {
            // Document model may not be loaded yet; skip on first save
        }
    }
});

module.exports = mongoose.model('ChangeRequest', ChangeRequestSchema);
