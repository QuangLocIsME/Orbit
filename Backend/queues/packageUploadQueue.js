const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = process.env.RABBITMQ_PACKAGE_UPLOAD_QUEUE || 'package_uploads';
const RECONNECT_DELAY_MS = Number(process.env.RABBITMQ_RECONNECT_DELAY_MS || 3000);
const HEARTBEAT_INTERVAL_SEC = Number(process.env.RABBITMQ_HEARTBEAT_INTERVAL_SEC || 30);

let connection = null;
let channel = null;
let reconnectTimer = null;
let consumerTag = null;
let isShuttingDown = false;

async function connectWithRetry(url) {
    return amqp.connect(url, { heartbeat: HEARTBEAT_INTERVAL_SEC });
}

async function createChannelWithRetry() {
    try {
        if (connection) {
            await connection.close().catch(() => {});
            connection = null;
        }

        connection = await connectWithRetry(RABBITMQ_URL);

        connection.on('error', (err) => {
            console.error('[packageUploadQueue] Connection error:', err?.message);
        });

        connection.on('close', () => {
            if (!isShuttingDown) {
                console.warn('[packageUploadQueue] Connection closed, reconnecting in', RECONNECT_DELAY_MS, 'ms...');
                scheduleReconnect();
            }
        });

        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log(`[packageUploadQueue] Queue '${QUEUE_NAME}' asserted`);
        return channel;
    } catch (err) {
        console.error('[packageUploadQueue] Failed to connect:', err?.message);
        scheduleReconnect();
        return null;
    }
}

function scheduleReconnect() {
    if (reconnectTimer || isShuttingDown) return;
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        await createChannelWithRetry();
    }, RECONNECT_DELAY_MS);
}

async function publishPackageUpload(jobPublicId, retries = 3, delayMs = 1000) {
    if (channel) {
        const payload = JSON.stringify({ jobId: jobPublicId });
        channel.sendToQueue(QUEUE_NAME, Buffer.from(payload), { persistent: true });
        return;
    }
    if (retries <= 0) {
        throw new Error(`Channel not ready after retries for upload job: ${jobPublicId}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
    await createChannelWithRetry();
    await publishPackageUpload(jobPublicId, retries - 1, delayMs * 2);
}

async function startPackageUploadConsumer(onMessage) {
    const prefetch = Number(process.env.RABBITMQ_PREFETCH || 3);
    const effectivePrefetch = Number.isFinite(prefetch) && prefetch > 0 ? prefetch : 3;

    const ch = await createChannelWithRetry();
    if (!ch) {
        console.error('[packageUploadQueue] Could not establish channel, consumer not started');
        return;
    }

    ch.prefetch(effectivePrefetch);

    const { consumerTag: tag } = await ch.consume(
        QUEUE_NAME,
        async (msg) => {
            if (!msg) return;
            try {
                const content = msg.content?.toString('utf8') || '{}';
                const parsed = JSON.parse(content);
                await onMessage(parsed);
                ch.ack(msg);
            } catch (err) {
                console.error('[packageUploadQueue] Message processing error:', err);
                ch.ack(msg);
            }
        },
        { noAck: false }
    );
    consumerTag = tag;

    const cleanup = async () => {
        isShuttingDown = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        console.log('[packageUploadQueue] Shutting down...');
        if (consumerTag && channel) {
            await channel.cancel(consumerTag).catch(() => {});
        }
        if (channel) await channel.close().catch(() => {});
        if (connection) await connection.close().catch(() => {});
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

module.exports = {
    publishPackageUpload,
    startPackageUploadConsumer,
    createChannelWithRetry,
};
