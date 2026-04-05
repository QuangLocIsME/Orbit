const { createClient } = require('redis');

const DEFAULT_TTL_SECONDS = Number(process.env.REDIS_CACHE_TTL_SECONDS) || 60;
const redisUrl = typeof process.env.REDIS_URL === 'string' ? process.env.REDIS_URL.trim() : '';
const redisDisabled = process.env.DISABLE_REDIS === '1' || redisUrl === '' || redisUrl === '0';

let client = null;
let enabled = Boolean(redisUrl) && !redisDisabled;
let connectingPromise = null;
let lastRedisErrorLog = 0;

function shutdownRedisClient() {
    if (!client) return;
    try {
        client.removeAllListeners();
    } catch {
        /* ignore */
    }
    try {
        if (client.isOpen) {
            client.disconnect().catch(() => {});
        } else {
            client.destroy?.();
        }
    } catch {
        /* ignore */
    }
    client = null;
}

async function ensureConnected() {
    if (!enabled) return null;

    if (!client) {
        client = createClient({
            url: redisUrl,
            socket: {
                // Do not retry forever when Redis is down (avoids console spam).
                reconnectStrategy: () => new Error('Redis unavailable'),
            },
        });

        client.on('error', (error) => {
            const now = Date.now();
            if (now - lastRedisErrorLog > 30_000) {
                lastRedisErrorLog = now;
                console.error('[Redis] error:', error?.message || error);
            }
        });
    }

    if (client.isOpen) return client;

    if (!connectingPromise) {
        connectingPromise = client
            .connect()
            .catch((error) => {
                console.error('[Redis] connect failed — cache disabled:', error?.message || error);
                enabled = false;
                shutdownRedisClient();
                return null;
            })
            .finally(() => {
                connectingPromise = null;
            });
    }

    await connectingPromise;
    return client?.isOpen ? client : null;
}

async function getJson(key) {
    try {
        const redis = await ensureConnected();
        if (!redis) return null;

        const raw = await redis.get(key);
        if (!raw) return null;

        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function setJson(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    try {
        const redis = await ensureConnected();
        if (!redis) return false;

        await redis.set(key, JSON.stringify(value), {
            EX: ttlSeconds,
        });

        return true;
    } catch {
        return false;
    }
}

async function delKeys(keys = []) {
    try {
        const redis = await ensureConnected();
        if (!redis || !keys.length) return false;

        await redis.del(keys);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    getJson,
    setJson,
    delKeys,
};
