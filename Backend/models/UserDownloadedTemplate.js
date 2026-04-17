const mongoose = require('mongoose');

const userDownloadedTemplateSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkflowTemplate',
        required: true,
        index: true,
    },
    publicId: {
        type: String,
        required: true,
        index: true,
    },
    downloadedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Compound index để đảm bảo mỗi user chỉ tải 1 template 1 lần
userDownloadedTemplateSchema.index({ userId: 1, publicId: 1 }, { unique: true });

module.exports = mongoose.model('UserDownloadedTemplate', userDownloadedTemplateSchema);