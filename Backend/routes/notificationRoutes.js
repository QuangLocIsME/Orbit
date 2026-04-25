const express = require('express');
const NotificationController = require('../controllers/NotificationController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', authenticate, (req, res) => NotificationController.list(req, res));
router.patch('/:notificationId/read', authenticate, (req, res) => NotificationController.markRead(req, res));
router.patch('/:notificationId/seen', authenticate, (req, res) => NotificationController.markSeen(req, res));
router.post('/mark-all-read', authenticate, (req, res) => NotificationController.markAllRead(req, res));
router.post('/mark-all-seen', authenticate, (req, res) => NotificationController.markAllSeen(req, res));
router.delete('/clear', authenticate, (req, res) => NotificationController.clearAll(req, res));
router.delete('/:notificationId', authenticate, (req, res) => NotificationController.delete(req, res));

module.exports = router;
