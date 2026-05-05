const NotificationRepository = require('../repositories/NotificationRepository');
const { errorResponse } = require('../utils/response');

class NotificationController {
    async list(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const limit = Math.min(parseInt(req.query?.limit) || 50, 50);
            const skip = parseInt(req.query?.skip) || 0;
            const unreadOnly = req.query?.unreadOnly === 'true';

            const [notifications, unreadCount, unseenCount] = await Promise.all([
                NotificationRepository.findByUserId(userId, { limit, skip, unreadOnly }),
                NotificationRepository.countUnreadByUserId(userId),
                NotificationRepository.countUnseenByUserId(userId),
            ]);

            return res.status(200).json({ success: true, data: { notifications, unreadCount, unseenCount } });
        } catch (err) {
            console.error('[NotificationController] list error:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
        }
    }

    async markRead(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const { notificationId } = req.params;
            if (!notificationId) {
                return errorResponse(res, 400, 'Missing notificationId');
            }

            const notification = notificationId.startsWith('invite:')
                ? await NotificationRepository.markReadByInviteId(userId, notificationId.replace('invite:', ''))
                : await NotificationRepository.markRead(userId, notificationId);
            if (!notification) {
                return errorResponse(res, 404, 'Notification not found');
            }

            return res.status(200).json({ success: true, data: notification });
        } catch (err) {
            console.error('[NotificationController] markRead error:', err);
            return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
        }
    }

    async markAllRead(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            await NotificationRepository.markAllRead(userId);
            return res.status(200).json({ success: true, data: { success: true } });
        } catch (err) {
            console.error('[NotificationController] markAllRead error:', err);
            return res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
        }
    }

    async markSeen(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const { notificationId } = req.params;
            if (!notificationId) {
                return errorResponse(res, 400, 'Missing notificationId');
            }

            const notification = notificationId.startsWith('invite:')
                ? await NotificationRepository.markSeenByInviteId(userId, notificationId.replace('invite:', ''))
                : await NotificationRepository.markSeen(userId, notificationId);
            if (!notification) {
                return errorResponse(res, 404, 'Notification not found');
            }

            return res.status(200).json({ success: true, data: notification });
        } catch (err) {
            console.error('[NotificationController] markSeen error:', err);
            return res.status(500).json({ success: false, message: 'Failed to mark notification as seen' });
        }
    }

    async markAllSeen(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            await NotificationRepository.markAllSeen(userId);
            return res.status(200).json({ success: true, data: { success: true } });
        } catch (err) {
            console.error('[NotificationController] markAllSeen error:', err);
            return res.status(500).json({ success: false, message: 'Failed to mark all notifications as seen' });
        }
    }

    async clearAll(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            await NotificationRepository.clearAll(userId);
            return res.status(200).json({ success: true, data: { success: true } });
        } catch (err) {
            console.error('[NotificationController] clearAll error:', err);
            return res.status(500).json({ success: false, message: 'Failed to clear notifications' });
        }
    }

    async delete(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const { notificationId } = req.params;
            if (!notificationId) {
                return errorResponse(res, 400, 'Missing notificationId');
            }

            let notification;
            if (notificationId.startsWith('invite:')) {
                const inviteId = notificationId.replace('invite:', '');
                notification = await NotificationRepository.deleteByInviteId(userId, inviteId);
            } else {
                notification = await NotificationRepository.delete(userId, notificationId);
            }

            if (!notification) {
                return errorResponse(res, 404, 'Notification not found');
            }

            return res.status(200).json({ success: true, data: notification });
        } catch (err) {
            console.error('[NotificationController] delete error:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete notification' });
        }
    }
}

module.exports = new NotificationController();
