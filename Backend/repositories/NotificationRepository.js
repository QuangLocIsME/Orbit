const Notification = require('../models/Notification');

const MAX_NOTIFICATIONS = 50;

class NotificationRepository {
    async create(data) {
        const notification = new Notification(data);
        return await notification.save();
    }

    async findByUserId(userId, options = {}) {
        const { limit = MAX_NOTIFICATIONS, skip = 0, unreadOnly = false } = options;
        const query = { userId };
        if (unreadOnly) {
            query.read = false;
        }
        return await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
    }

    async countUnreadByUserId(userId) {
        return await Notification.countDocuments({ userId, read: false });
    }

    async countUnseenByUserId(userId) {
        return await Notification.countDocuments({ userId, seen: false });
    }

    async markRead(userId, notificationId) {
        return await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { read: true, seen: true },
            { returnDocument: 'after' }
        );
    }

    async markAllRead(userId) {
        return await Notification.updateMany(
            { userId, read: false },
            { read: true }
        );
    }

    async markSeen(userId, notificationId) {
        return await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { seen: true },
            { returnDocument: 'after' }
        );
    }

    async markAllSeen(userId) {
        return await Notification.updateMany(
            { userId, seen: false },
            { seen: true }
        );
    }

    async clearAll(userId) {
        return await Notification.deleteMany({ userId });
    }

    async findByRef(userId, refType, refId) {
        return await Notification.findOne({ userId, refType, refId });
    }

    async deleteOld(userId) {
        const count = await Notification.countDocuments({ userId });
        if (count <= MAX_NOTIFICATIONS) return;
        const oldOnes = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .skip(MAX_NOTIFICATIONS)
            .select('_id');
        const ids = oldOnes.map((n) => n._id);
        return await Notification.deleteMany({ _id: { $in: ids } });
    }

    async delete(userId, notificationId) {
        return await Notification.findOneAndDelete({ _id: notificationId, userId });
    }

    async deleteByInviteId(userId, inviteId) {
        return await Notification.findOneAndDelete({ userId, 'inviteData.inviteId': inviteId });
    }
}

module.exports = new NotificationRepository();
