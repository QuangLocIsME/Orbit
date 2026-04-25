const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '', trim: true },
    link: { type: String, default: '', trim: true },
    read: { type: Boolean, default: false, index: true },
    // seen: user opened the notification dropdown (different from read = user clicked the notification)
    seen: { type: Boolean, default: false, index: true },
    // For invite notifications
    inviteData: {
        inviteId: { type: String, default: null },
        token: { type: String, default: null },
        projectId: { type: String, default: null },
        projectName: { type: String, default: null },
        projectAvatar: { type: String, default: null },
        role: { type: String, default: null },
        inviterName: { type: String, default: null },
        acceptUrl: { type: String, default: null },
    },
    // Reference IDs for deduplication
    refType: { type: String, default: null }, // 'invite' | 'task' | etc.
    refId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, seen: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, refType: 1, refId: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
