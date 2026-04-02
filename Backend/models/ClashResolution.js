const mongoose = require('mongoose');

const HistoryEntrySchema = new mongoose.Schema(
    {
        id: { type: String },
        type: { type: String, default: 'note-added' },
        message: { type: String, required: true },
        timestamp: { type: String, required: true },
        user: { type: String, default: null },
    },
    { _id: false }
);

const ClashResolutionSchema = new mongoose.Schema({
    projectSlug: { type: String, required: true, index: true },
    clashId:     { type: String, required: true, index: true },
    resolved:    { type: Boolean, default: false },
    waived:      { type: Boolean, default: false },
    stale:       { type: Boolean, default: false },
    status:      { type: String, enum: ['open', 'in-progress', 'resolved', 'waived'], default: 'open' },
    note:        { type: String, default: '' },
    severity:    { type: String, enum: ['low', 'medium', 'high', 'critical', null], default: null },
    assignedTo:  { type: String, default: null },
    dueDate:     { type: String, default: null },
    history:     { type: [HistoryEntrySchema], default: [] },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
});

// Compound index để query nhanh theo (projectSlug, clashId)
ClashResolutionSchema.index({ projectSlug: 1, clashId: 1 }, { unique: true });

module.exports = mongoose.model('ClashResolution', ClashResolutionSchema);
