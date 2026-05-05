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
const { createClient } = require('redis');
const { verifyToken } = require('../utils/jwt');
const { normalizeRedisUrl } = require('../utils/redisUrl');

// ── Singleton state ───────────────────────────────────────────────────────────
let io = null;
const REALTIME_CHANNEL = 'orbit:realtime';
const redisUrl = normalizeRedisUrl(process.env.REDIS_URL);
let realtimeSubscriber = null;
let realtimePublisher = null;
let realtimePublisherPromise = null;

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

function emitRealtimeMessage(message) {
    if (!io || !message || !message.event) return;

    const { target, id, event, data } = message;
    if (target === 'project' && id) {
        io.to(`project:${id}`).emit(event, data);
        return;
    }
    if (target === 'package' && id) {
        io.to(`package:${id}`).emit(event, data);
        return;
    }
    if (target === 'user' && id) {
        io.to(`user:${id}`).emit(event, data);
        return;
    }
    if (target === 'all') {
        io.emit(event, data);
    }
}

async function subscribeRealtimeChannel() {
    if (!redisUrl || realtimeSubscriber) return;

    try {
        realtimeSubscriber = createClient({ url: redisUrl });
        realtimeSubscriber.on('error', (error) => {
            console.error('[WS] Redis realtime subscriber error:', error?.message || error);
        });
        await realtimeSubscriber.connect();
        await realtimeSubscriber.subscribe(REALTIME_CHANNEL, (raw) => {
            try {
                emitRealtimeMessage(JSON.parse(raw));
            } catch (error) {
                console.error('[WS] Invalid realtime message:', error?.message || error);
            }
        });
        console.log('[WS] Redis realtime bridge subscribed');
    } catch (error) {
        console.error('[WS] Redis realtime bridge unavailable:', error?.message || error);
        realtimeSubscriber = null;
    }
}

async function getRealtimePublisher() {
    if (!redisUrl) return null;
    if (realtimePublisher?.isOpen) return realtimePublisher;

    if (!realtimePublisherPromise) {
        realtimePublisher = createClient({ url: redisUrl });
        realtimePublisher.on('error', (error) => {
            console.error('[WS] Redis realtime publisher error:', error?.message || error);
        });
        realtimePublisherPromise = realtimePublisher.connect()
            .then(() => realtimePublisher)
            .catch((error) => {
                console.error('[WS] Redis realtime publisher unavailable:', error?.message || error);
                realtimePublisher = null;
                return null;
            })
            .finally(() => {
                realtimePublisherPromise = null;
            });
    }

    return realtimePublisherPromise;
}

async function publishRealtime(message) {
    if (!message?.event) return false;

    const publisher = await getRealtimePublisher();
    if (publisher) {
        await publisher.publish(REALTIME_CHANNEL, JSON.stringify(message));
        return true;
    }

    if (io) {
        emitRealtimeMessage(message);
        return true;
    }

    return false;
}

function queueRealtime(message) {
    publishRealtime(message).catch((error) => {
        console.error('[WS] Realtime dispatch failed:', error?.message || error);
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Call once from app.js: attachSocket(httpServer)
 */
function attachSocket(httpServer) {
    if (io) return io; // already initialised

    const frontendOrigins = Array.from(new Set([
        process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321',
        process.env.FRONTEND_URI_LAN || process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321',
    ].filter(Boolean)));

    io = new Server(httpServer, {
        cors: {
            origin: frontendOrigins,
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
    subscribeRealtimeChannel().catch((error) => {
        console.error('[WS] Redis realtime subscribe failed:', error?.message || error);
    });
    return io;
}

// ── Emit helpers (call from controllers / services) ───────────────────────────

/**
 * Emit an event to a specific user's private room.
 *  notifyUser('abc123', 'notification:new', { title: '...', ... })
 */
function notifyUser(userId, event, data) {
    if (!userId || !event) return;
    queueRealtime({ target: 'user', id: userId, event, data });
}

/**
 * Broadcast an event to everyone in a project room.
 *  broadcastProject('proj123', 'project:updated', { ... })
 */
function broadcastProject(projectId, event, data) {
    if (!projectId || !event) return;
    queueRealtime({ target: 'project', id: projectId, event, data });
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
    publishRealtime,
};
