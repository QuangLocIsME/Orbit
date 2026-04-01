const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = process.env.RABBITMQ_PACKAGE_UPLOAD_QUEUE || 'package_uploads';

async function createChannel() {
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    return { conn, channel };
}

async function publishPackageUpload(jobPublicId) {
    const { conn, channel } = await createChannel();
    try {
        const payload = JSON.stringify({ jobId: jobPublicId });
        channel.sendToQueue(
            QUEUE_NAME,
            Buffer.from(payload),
            { persistent: true }
        );
    } finally {
        await channel.close().catch(() => {});
        await conn.close().catch(() => {});
    }
}

async function startPackageUploadConsumer(onMessage) {
    const { conn, channel } = await createChannel();
    channel.prefetch(1);

    await channel.consume(
        QUEUE_NAME,
        async (msg) => {
            if (!msg) return;
            try {
                const content = msg.content?.toString('utf8') || '{}';
                const parsed = JSON.parse(content);
                await onMessage(parsed);
                channel.ack(msg);
            } catch (err) {
                // Worker sẽ tự update job thất bại; ở đây chỉ ack để tránh loop
                channel.ack(msg);
            }
        },
        { noAck: false }
    );

    // process-level cleanup
    const cleanup = async () => {
        await channel.close().catch(() => {});
        await conn.close().catch(() => {});
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

module.exports = {
    publishPackageUpload,
    startPackageUploadConsumer,
};

