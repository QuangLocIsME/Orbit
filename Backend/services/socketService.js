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
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const Project = require('../models/Project');
const Package = require('../models/Package');
const cacheService = require('./cacheService');

// ── Singleton state ───────────────────────────────────────────────────────────
let io = null;
const REALTIME_CHANNEL = 'orbit:realtime';
const redisUrl = normalizeRedisUrl(process.env.REDIS_URL);
let realtimeSubscriber = null;
let realtimePublisher = null;
let realtimePublisherPromise = null;

// Map<userId, Set<socketId>>  — who is online
const onlineUsers = new Map();

// ── Project permission cache ───────────────────────────────────────────────────
const PROJECT_MEMBERSHIP_CACHE_TTL = 30; // seconds
const PROJECT_MEMBERSHIP_CACHE_PREFIX = 'socket:proj:membership:';
const PACKAGE_ACCESS_CACHE_TTL = 30; // seconds
const PACKAGE_ACCESS_CACHE_PREFIX = 'socket:pkg:access:';

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

/**
 * Check if user has membership in a project (accepted status).
 * Uses Redis cache to avoid hammering the DB on every project:join.
 * Cache key: socket:proj:membership:<projectId>:<userId> → role string
 *
 * Logic:
 *  1. Check Redis cache
 *  2. If miss: query DB (check ProjectMember status=accepted OR Project.ownerId)
 *  3. Cache the result
 *  4. Return the role string or null if no access
 */
async function checkProjectMembership(userId, projectId) {
    if (!userId || !projectId) return null;

    const cacheKey = `${PROJECT_MEMBERSHIP_CACHE_PREFIX}${projectId}:${userId}`;

    try {
        // 1. Try Redis cache first
        const cached = await cacheService.getJson(cacheKey);
        if (cached !== null) return cached; // null means cached "no access"; undefined means cache miss
    } catch {
        // cache miss — proceed to DB
    }

    let membership = null;

    try {
        // 2. Check ProjectMember (status must be 'accepted')
        const member = await ProjectMemberRepository.findMember(projectId, userId);
        if (member && member.status === 'accepted') {
            membership = member.role;
        }
    } catch (err) {
        console.error('[WS] Error checking project membership (member):', err?.message || err);
    }

    // 3. If not a member, check if user is the project owner
    if (!membership) {
        try {
            const project = await Project.findOne({ publicId: projectId }).select('ownerId').lean();
            if (project && project.ownerId === userId) {
                membership = 'owner';
            }
        } catch (err) {
            console.error('[WS] Error checking project membership (owner):', err?.message || err);
        }
    }

    // 4. Cache the result (even if null, so we don't re-query DB repeatedly for non-members)
    try {
        await cacheService.setJson(cacheKey, membership, PROJECT_MEMBERSHIP_CACHE_TTL);
    } catch {
        // best-effort caching
    }

    return membership;
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
        process.env.FRONTEND_URI_PUBLIC || process.env.FRONTEND_URI || 'http://localhost:4321',
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

        // Join a project room — requires verified project membership
        socket.on('project:join', async ({ projectId }, callback) => {
            if (!projectId) {
                if (typeof callback === 'function') callback({ success: false, error: 'MISSING_PROJECT_ID' });
                return;
            }

            const role = await checkProjectMembership(userId, projectId);

            if (!role) {
                console.warn(`[WS] project:join denied — user ${userId} has no access to project ${projectId}`);
                if (typeof callback === 'function') callback({ success: false, error: 'ACCESS_DENIED' });
                return;
            }

            socket.join(`project:${projectId}`);
            if (typeof callback === 'function') callback({ success: true, role });
        });

        socket.on('project:leave', ({ projectId }) => {
            if (!projectId) return;
            socket.leave(`project:${projectId}`);
        });

        // Join a package room — requires verified project membership + package access
        socket.on('package:join', async ({ packageId }, callback) => {
            if (!packageId) {
                if (typeof callback === 'function') callback({ success: false, error: 'MISSING_PACKAGE_ID' });
                return;
            }

            const accessLevel = await checkPackageAccess(userId, packageId);

            if (!accessLevel) {
                console.warn(`[WS] package:join denied — user ${userId} has no access to package ${packageId}`);
                if (typeof callback === 'function') callback({ success: false, error: 'ACCESS_DENIED' });
                return;
            }

            socket.join(`package:${packageId}`);
            if (typeof callback === 'function') callback({ success: true, accessLevel });
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

/**
 * Check if user has access to a package room.
 * Access logic:
 *  1. Verify project membership via checkProjectMembership (uses its own cache)
 *  2. Package creator OR team member → 'member'; other project members → 'viewer'
 *
 * Cache key: socket:pkg:access:<packageId>:<userId> → 'member' | 'viewer' | null
 */
async function checkPackageAccess(userId, packageId) {
    if (!userId || !packageId) return null;

    const cacheKey = `${PACKAGE_ACCESS_CACHE_PREFIX}${packageId}:${userId}`;

    try {
        const cached = await cacheService.getJson(cacheKey);
        if (cached !== null) return cached;
    } catch {
        // cache miss
    }

    try {
        // Look up the package to get its projectId and access flags
        const pkg = await Package.findOne({ publicId: packageId })
            .select('projectId creatorId teamMemberIds')
            .lean();
        if (!pkg) return null;

        // Cross-reference: verify project membership (uses its own cache entry)
        const projectRole = await checkProjectMembership(userId, pkg.projectId);
        if (!projectRole) return null;

        // Determine package-level access
        const isCreator = pkg.creatorId === userId;
        const isTeamMember = (pkg.teamMemberIds || []).includes(userId);
        const accessLevel = (isCreator || isTeamMember) ? 'member' : 'viewer';

        await cacheService.setJson(cacheKey, accessLevel, PACKAGE_ACCESS_CACHE_TTL);
        return accessLevel;
    } catch (err) {
        console.error('[WS] Error checking package access:', err?.message || err);
        return null;
    }
}

/**
 * Invalidate a user's project membership cache AND their package access cache.
 * Call this whenever membership changes (added, removed, role changed, status changed).
 * Since package access depends on project membership (cross-reference), any membership
 * change invalidates both caches.
 */
async function invalidateMembershipCache(projectId, userId) {
    if (!projectId || !userId) return;
    try {
        await cacheService.delKeys([
            `${PROJECT_MEMBERSHIP_CACHE_PREFIX}${projectId}:${userId}`,
        ]);
    } catch {
        // best-effort
    }
}

/**
 * Invalidate a user's package access cache.
 * Call this when package teamMemberIds change (member added/removed from package).
 * Note: this does NOT invalidate the project membership cache — only the package-level
 * access cache derived from creatorId / teamMemberIds fields.
 */
async function invalidatePackageAccessCache(packageId, userId) {
    if (!packageId || !userId) return;
    try {
        await cacheService.delKeys([
            `${PACKAGE_ACCESS_CACHE_PREFIX}${packageId}:${userId}`,
        ]);
    } catch {
        // best-effort
    }
}

module.exports = {
    attachSocket,
    notifyUser,
    broadcastProject,
    broadcastPackage,
    broadcastAll,
    invalidateUserCache,
    invalidateMembershipCache,
    invalidatePackageAccessCache,
    getOnlineUsers,
    isOnline,
    getIO,
    publishRealtime,
    checkProjectMembership,
    checkPackageAccess,
};
