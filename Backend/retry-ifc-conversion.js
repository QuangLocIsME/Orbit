require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const mongoose = require('mongoose');

async function retryIfcConversion() {
    await mongoose.connect(process.env.MONGODB_URI);

    const amqp = require('amqplib');
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
    const IFC_QUEUE_NAME = process.env.RABBITMQ_IFC_CONVERSION_QUEUE || 'ifc_to_xkt';

    // Tìm tất cả document IFC ở trạng thái PENDING hoặc FAILED (chưa convert thành công)
    const docs = await mongoose.connection.db.collection('documents').find({
        conversionStatus: { $in: ['PENDING', 'FAILED'] },
        originalName: { $regex: /\.ifc$/i }
    }).toArray();

    if (!docs.length) {
        console.log('Khong co document IFC nao o trang thai PENDING hoac FAILED');
        await mongoose.disconnect();
        return;
    }

    console.log(`Tim thay ${docs.length} document(s) can retry\n`);

    // Kết nối RabbitMQ
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(IFC_QUEUE_NAME, { durable: true });

    for (const doc of docs) {
        console.log(`=== Republishing: ${doc.originalName} (${doc.conversionStatus}) ===`);

        await mongoose.connection.db.collection('documents').updateOne(
            { _id: doc._id },
            { $set: { conversionStatus: 'PENDING', conversionError: '', updatedAt: new Date() } }
        );

        const job = {
            projectId: doc.projectId,
            documentId: doc.publicId,
            versionId: doc.publicId,
            ifcS3Bucket: doc.s3Bucket,
            ifcS3Key: doc.s3Key,
            requestedBy: doc.uploadedBy || 'system',
        };

        channel.sendToQueue(IFC_QUEUE_NAME, Buffer.from(JSON.stringify(job)), { persistent: true });
        console.log(`  Queued: ${doc.publicId}`);
    }

    console.log(`\nDa publish ${docs.length} job(s) vao queue '${IFC_QUEUE_NAME}'`);
    await channel.close();
    await conn.close();
    await mongoose.disconnect();
}

retryIfcConversion().catch(console.error);
