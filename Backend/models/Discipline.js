const mongoose = require('mongoose');
const crypto = require('crypto');

const DisciplineSchema = new mongoose.Schema({
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
        maxlength: 100,
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
    },
    color: {
        type: String,
        default: '#6366f1',
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

DisciplineSchema.index({ projectId: 1, name: 1 }, { unique: true });
DisciplineSchema.index({ projectId: 1, createdAt: -1 });

DisciplineSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Discipline', DisciplineSchema);
