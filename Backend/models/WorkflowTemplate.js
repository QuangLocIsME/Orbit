const mongoose = require('mongoose');
const crypto = require('crypto');

const WorkflowStageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    color: {
        type: String,
        enum: ['gray', 'blue', 'yellow', 'orange', 'green', 'red'],
        default: 'gray',
    },
});

const WorkflowTemplateSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: {
        type: String,
        enum: ['Construction', 'Software Development', 'Marketing', 'Design', 'Operations', 'HR', 'Finance', 'Other'],
        default: 'Other',
    },
    tags: { type: [String], default: [], index: true },
    stages: {
        type: [WorkflowStageSchema],
        required: true,
        validate: [arr => arr.length > 0, 'At least one stage is required'],
    },
    authorId: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    isPrivate: { type: Boolean, default: false },
    downloads: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Index for searching
WorkflowTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Pre-save middleware to update timestamps
WorkflowTemplateSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('WorkflowTemplate', WorkflowTemplateSchema);
