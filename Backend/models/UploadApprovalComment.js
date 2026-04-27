const mongoose = require('mongoose');
const crypto = require('crypto');

const UploadApprovalCommentSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    approvalId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

UploadApprovalCommentSchema.index({ approvalId: 1, createdAt: -1 });

module.exports = mongoose.model('UploadApprovalComment', UploadApprovalCommentSchema);
