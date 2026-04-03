/**
 * ORBIT WebSocket Service (Socket.io)
 *
 * Responsibilities:
 *  - Attach Socket.io to the existing HTTP server
 *  - Authenticate every connection via the accessToken httpOnly cookie
 *  - Manage per-user rooms, per-project rooms, and presence tracking
 *  - Expose emit helpers for controllers/services to push real-time events
 *
 * Room naming conventions:
 *  user:<userId>         — private events for one user
 *  project:<projectId>   — broadcast within a project
 *  package:<packageId>   — broadcast within a package
 */

const { Server } = require('socket.io');
const cookie = require('cookie');
const { verifyToken } = require('../utils/jwt');

// ── Singleton state ───────────────────────────────────────────────────────────
let io = null;

// Map<userId, Set<socketId>>  — who is online
const onlineUsers = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function addOnline(userId, socketId) {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
}

function removeOnline(userId, socketId) {
    const set = onlineUsers.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) onlineUsers.delete(userId);
}

function isOnline(userId) {
    return onlineUsers.has(userId);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Call once from app.js: attachSocket(httpServer)
 */
function attachSocket(httpServer) {
    if (io) return io; // already initialised

    const frontendOrigin =
        process.env.FRONTEND_URI ||
        process.env.FRONTED_URI ||
        'http://localhost:4321';

    io = new Server(httpServer, {
        cors: {
            origin: frontendOrigin,
            credentials: true,
        },
        // Use long-polling as fallback so it works behind any proxy
        transports: ['websocket', 'polling'],
    });

    // ── Auth middleware (runs before "connection") ────────────────────────────
    io.use((socket, next) => {
        try {
            // Parse cookies from the upgrade/poll request
            const rawCookie = socket.handshake.headers.cookie || '';
            const cookies = cookie.parse(rawCookie);
            const token = cookies.accessToken;

            if (!token) {
                return next(new Error('NO_TOKEN'));
            }

            const payload = verifyToken(token);
            if (!payload?.id) return next(new Error('INVALID_TOKEN'));

            // Attach user info to the socket for later use
            socket.user = {
                id: String(payload.id),
                email: payload.email,
                role: payload.role,
            };

            return next();
        } catch (err) {
            return next(new Error('INVALID_TOKEN'));
        }
    });

    // ── Connection handler ────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        const { id: userId, email } = socket.user;

        addOnline(userId, socket.id);

        // Auto-join the user's private room
        socket.join(`user:${userId}`);

        // Let others know this user came online
        socket.broadcast.emit('user:online', { userId });

        // ── Client-initiated events ───────────────────────────────────────────

        // Join a project room to receive project-level events
        socket.on('project:join', ({ projectId }) => {
            if (!projectId) return;
            socket.join(`project:${projectId}`);
        });

        socket.on('project:leave', ({ projectId }) => {
            if (!projectId) return;
            socket.leave(`project:${projectId}`);
        });

        // Join a package room
        socket.on('package:join', ({ packageId }) => {
            if (!packageId) return;
            socket.join(`package:${packageId}`);
        });

        socket.on('package:leave', ({ packageId }) => {
            if (!packageId) return;
            socket.leave(`package:${packageId}`);
        });

        // Ping / heartbeat (client can use this to measure latency)
        socket.on('ping', (cb) => {
            if (typeof cb === 'function') cb({ ts: Date.now() });
        });

        // ── Disconnection ─────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            removeOnline(userId, socket.id);
            if (!isOnline(userId)) {
                // User has no more active sockets → broadcast offline
                socket.broadcast.emit('user:offline', { userId });
            }
        });
    });

    console.log('[WS] Socket.io attached');
    return io;
}

// ── Emit helpers (call from controllers / services) ───────────────────────────

/**
 * Emit an event to a specific user's private room.
 *  notifyUser('abc123', 'notification:new', { title: '...', ... })
 */
function notifyUser(userId, event, data) {
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
}

/**
 * Broadcast an event to everyone in a project room.
 *  broadcastProject('proj123', 'project:updated', { ... })
 */
function broadcastProject(projectId, event, data) {
    if (!io) return;
    io.to(`project:${projectId}`).emit(event, data);
}

/**
 * Broadcast an event to everyone in a package room.
 */
function broadcastPackage(packageId, event, data) {
    if (!io) return;
    io.to(`package:${packageId}`).emit(event, data);
}

/**
 * Invalidate a user's cached data in the frontend.
 * Call this after any mutation so clients can bust their in-memory / sessionStorage cache.
 * Sends to the user's private room: { type: 'cache:invalidate', data: { cacheTypes, userId } }
 */
function invalidateUserCache(userId, cacheTypes = ['projects', 'folders', 'auth']) {
    if (!io) return;
    io.to(`user:${userId}`).emit('cache:invalidate', {
        type: 'cache:invalidate',
        data: { cacheTypes, userId },
    });
}

/**
 * Broadcast to all connected clients.
 */
function broadcastAll(event, data) {
    if (!io) return;
    io.emit(event, data);
}

/**
 * Returns the list of online user IDs.
 */
function getOnlineUsers() {
    return [...onlineUsers.keys()];
}

/**
 * Get the io instance (useful for advanced use-cases).
 */
function getIO() {
    return io;
}

module.exports = {
    attachSocket,
    notifyUser,
    broadcastProject,
    broadcastPackage,
    broadcastAll,
    invalidateUserCache,
    getOnlineUsers,
    isOnline,
    getIO,
};
