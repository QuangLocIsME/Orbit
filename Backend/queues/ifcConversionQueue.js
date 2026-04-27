const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const IFC_QUEUE_NAME = process.env.RABBITMQ_IFC_CONVERSION_QUEUE || 'ifc_to_xkt';
const RECONNECT_DELAY_MS = Number(process.env.RABBITMQ_RECONNECT_DELAY_MS || 3000);
const HEARTBEAT_INTERVAL_SEC = Number(process.env.RABBITMQ_HEARTBEAT_INTERVAL_SEC || 30);

let connection = null;
let channel = null;
let reconnectTimer = null;
let consumerTag = null;
let isShuttingDown = false;

async function connectWithRetry(url) {
    const options = { heartbeat: HEARTBEAT_INTERVAL_SEC };
    return amqp.connect(url, options);
}

async function createChannelWithRetry() {
    try {
        if (connection) {
            await connection.close().catch(() => {});
            connection = null;
        }

        connection = await connectWithRetry(RABBITMQ_URL);

        connection.on('error', (err) => {
            console.error('[ifcConversionQueue] Connection error:', err?.message);
        });

        connection.on('close', () => {
            if (!isShuttingDown) {
                console.warn('[ifcConversionQueue] Connection closed, reconnecting in', RECONNECT_DELAY_MS, 'ms...');
                scheduleReconnect();
            }
        });

        channel = await connection.createChannel();
        await channel.assertQueue(IFC_QUEUE_NAME, { durable: true });
        console.log(`[ifcConversionQueue] IFC queue '${IFC_QUEUE_NAME}' ready, waiting for jobs...`);
        return channel;
    } catch (err) {
        console.error('[ifcConversionQueue] Failed to connect:', err?.message);
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

async function publishIfcConversionJob(payload, retries = 3, delayMs = 1000) {
    if (channel) {
        const data = JSON.stringify(payload || {});
        channel.sendToQueue(IFC_QUEUE_NAME, Buffer.from(data), { persistent: true });
        return;
    }
    if (retries <= 0) {
        throw new Error(`Channel not ready after retries for IFC job: ${payload?.versionId || payload?.documentId}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
    await createChannelWithRetry();
    await publishIfcConversionJob(payload, retries - 1, delayMs * 2);
}

async function startIfcConversionConsumer(onMessage) {
    const prefetch = Number(process.env.RABBITMQ_PREFETCH || 2);
    const effectivePrefetch = Number.isFinite(prefetch) && prefetch > 0 ? prefetch : 2;

    const ch = await createChannelWithRetry();
    if (!ch) {
        console.error('[ifcConversionQueue] Could not establish channel, consumer not started');
        return;
    }

    ch.prefetch(effectivePrefetch);

    const { consumerTag: tag } = await ch.consume(
        IFC_QUEUE_NAME,
        async (msg) => {
            if (!msg) return;
            try {
                const parsed = JSON.parse(msg.content?.toString('utf8') || '{}');
                console.log(`[ifcConversionQueue] Received job:`, parsed);
                await onMessage(parsed);
                ch.ack(msg);
            } catch (error) {
                console.error('[ifcConversionQueue] Message processing error:', error);
                ch.ack(msg);
            }
        },
        { noAck: false }
    );
    consumerTag = tag;

    const cleanup = async () => {
        isShuttingDown = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        console.log('[ifcConversionQueue] Shutting down...');
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
    publishIfcConversionJob,
    startIfcConversionConsumer,
    createChannelWithRetry,
};
