const mongoose = require('mongoose');
const crypto = require('crypto');

const TaskCommentSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    taskId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    packageId: { type: String, default: null, index: true },
    authorId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

TaskCommentSchema.index({ projectId: 1, packageId: 1, taskId: 1, createdAt: -1 });

module.exports = mongoose.model('TaskComment', TaskCommentSchema);
