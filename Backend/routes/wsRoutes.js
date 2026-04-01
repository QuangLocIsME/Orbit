/**
 * REST endpoints that complement the WebSocket layer.
 * Useful for SSR / initial page load where WS isn't connected yet.
 */
const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { getOnlineUsers, isOnline } = require('../services/socketService');

const router = express.Router();

// GET /api/ws/online  — returns list of online user IDs
router.get('/online', authenticate, (req, res) => {
    res.json({ success: true, data: getOnlineUsers() });
});

// GET /api/ws/online/:userId
router.get('/online/:userId', authenticate, (req, res) => {
    res.json({ success: true, data: { online: isOnline(req.params.userId) } });
});

module.exports = router;
