require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const mongoose = require('mongoose');

async function retryIfcConversion() {
    await mongoose.connect(process.env.MONGODB_URI);

    const amqp = require('amqplib');
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
    const IFC_QUEUE_NAME = process.env.RABBITMQ_IFC_CONVERSION_QUEUE || 'ifc_to_xkt';

    // Tìm document IFC đang ở trạng thái FAILED
    const doc = await mongoose.connection.db.collection('documents').findOne({
        conversionStatus: 'FAILED',
        originalName: { $regex: /\.ifc$/i }
    });

    if (!doc) {
        console.log('Không tìm thấy document IFC nào ở trạng thái FAILED');
        await mongoose.disconnect();
        return;
    }

    console.log(`\n=== Retrying conversion for: ${doc.originalName} ===`);
    console.log(`Document ID: ${doc.publicId}`);
    console.log(`Project ID: ${doc.projectId}`);
    console.log(`S3 Bucket: ${doc.s3Bucket}`);
    console.log(`S3 Key: ${doc.s3Key}`);

    // Cập nhật trạng thái thành PENDING
    await mongoose.connection.db.collection('documents').updateOne(
        { _id: doc._id },
        {
            $set: {
                conversionStatus: 'PENDING',
                conversionError: '',
                updatedAt: new Date()
            }
        }
    );

    // Publish job vào RabbitMQ
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(IFC_QUEUE_NAME, { durable: true });

    const job = {
        projectId: doc.projectId,
        documentId: doc.publicId,
        versionId: doc.publicId,
        ifcS3Bucket: doc.s3Bucket,
        ifcS3Key: doc.s3Key,
        requestedBy: doc.uploadedBy || 'system',
    };

    channel.sendToQueue(IFC_QUEUE_NAME, Buffer.from(JSON.stringify(job)), { persistent: true });

    console.log(`\n✅ Đã publish job vào queue '${IFC_QUEUE_NAME}'`);
    console.log(`Job data:`, JSON.stringify(job, null, 2));

    await channel.close();
    await conn.close();
    await mongoose.disconnect();
}

retryIfcConversion().catch(console.error);
