const mongoose = require('mongoose');
const crypto = require('crypto');

const CRVersionSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    crId: {
        type: String,
        required: true,
        index: true,
    },
    projectId: {
        type: String,
        required: true,
        index: true,
    },
    versionNumber: {
        type: Number,
        default: 1,
    },
    versionLabel: {
        type: String,
        default: '',
        trim: true,
    },
    snapshot: {
        title:              { type: String, default: '' },
        description:        { type: String, default: '' },
        priority:          { type: String, default: '' },
        estimatedImpact:   { type: String, default: null },
        affectedModels:   [{ type: String, default: '' }],
        disciplineId:       { type: String, default: null },
        attachments: [{
            name:     { type: String, default: '' },
            size:     { type: Number, default: 0 },
            url:      { type: String, default: '' },
            mimeType: { type: String, default: '' },
        }],
        structuredSections: {
            context:        { type: String, default: '' },
            problem:        { type: String, default: '' },
            proposedChange: { type: String, default: '' },
            impact: {
                estimatedImpact:       { type: String, enum: ['low', 'medium', 'high', null], default: null },
                affectedModels:       [{ type: String, default: '' }],
                clashCheckRequired:   { type: Boolean, default: false },
            },
        },
        taskIds:          [{ type: String, default: '' }],
        completedBy:      { type: String, default: null },
        completedAt:      { type: Date, default: null },
    },
    resultFiles: [{
        name:             { type: String, default: '' },
        size:             { type: Number, default: 0 },
        url:              { type: String, default: '' },
        mimeType:         { type: String, default: '' },
        sourceDocumentId: { type: String, default: '' },
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true,
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

CRVersionSchema.index({ crId: 1, versionNumber: -1 });
CRVersionSchema.index({ projectId: 1, createdAt: -1 });

CRVersionSchema.pre('validate', async function () {
    if (this.isNew && this.versionNumber === 1) {
        const count = await mongoose.model('CRVersion').countDocuments({ crId: this.crId });
        this.versionNumber = count + 1;
    }
});

module.exports = mongoose.model('CRVersion', CRVersionSchema);
