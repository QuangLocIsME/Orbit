const mongoose = require('mongoose');
const crypto = require('crypto');

const ProjectSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    industry: { type: String, default: '', trim: true },
    coverImageUrl: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', ProjectSchema);
