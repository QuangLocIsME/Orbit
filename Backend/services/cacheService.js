const { createClient } = require('redis');
const { normalizeRedisUrl } = require('../utils/redisUrl');

const DEFAULT_TTL_SECONDS = Number(process.env.REDIS_CACHE_TTL_SECONDS) || 60;
const redisUrl = normalizeRedisUrl(process.env.REDIS_URL);

let client = null;
let enabled = Boolean(redisUrl);
let connectingPromise = null;

async function ensureConnected() {
    if (!enabled) return null;

    if (!client) {
        client = createClient({ url: redisUrl });

        client.on('error', (error) => {
            console.error('[Redis] error:', error?.message || error);
        });
    }

    if (client.isOpen) return client;

    if (!connectingPromise) {
        connectingPromise = client.connect().catch((error) => {
            console.error('[Redis] connect failed:', error?.message || error);
            enabled = false;
            return null;
        }).finally(() => {
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
