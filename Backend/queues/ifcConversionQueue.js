const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const IFC_QUEUE_NAME = process.env.RABBITMQ_IFC_CONVERSION_QUEUE || 'ifc_to_xkt';

let sharedConn = null;
let sharedChannel = null;

async function getSharedChannel() {
    if (sharedChannel) return sharedChannel;
    sharedConn = await amqp.connect(RABBITMQ_URL);
    sharedChannel = await sharedConn.createChannel();
    await sharedChannel.assertQueue(IFC_QUEUE_NAME, { durable: true });
    return sharedChannel;
}

async function publishIfcConversionJob(payload) {
    const channel = await getSharedChannel();
    const data = JSON.stringify(payload || {});
    channel.sendToQueue(IFC_QUEUE_NAME, Buffer.from(data), { persistent: true });
}

async function startIfcConversionConsumer(onMessage) {
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(IFC_QUEUE_NAME, { durable: true });

    console.log(`[ifcConversionWorker] IFC queue '${IFC_QUEUE_NAME}' ready, waiting for jobs...`);

    const prefetch = Number(process.env.RABBITMQ_PREFETCH || 2);
    channel.prefetch(Number.isFinite(prefetch) && prefetch > 0 ? prefetch : 2);

    await channel.consume(
        IFC_QUEUE_NAME,
        async (msg) => {
            if (!msg) return;
            try {
                const parsed = JSON.parse(msg.content?.toString('utf8') || '{}');
                console.log(`[ifcConversionWorker] Received job:`, parsed);
                await onMessage(parsed);
                channel.ack(msg);
            } catch (error) {
                channel.ack(msg);
            }
        },
        { noAck: false }
    );

    const cleanup = async () => {
        await channel.close().catch(() => {});
        await conn.close().catch(() => {});
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

module.exports = {
    publishIfcConversionJob,
    startIfcConversionConsumer,
};
