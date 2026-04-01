const path = require('path');
// Luôn đọc .env tại thư mục Backend (kể cả khi chạy: cd workers && node packageUploadWorker.js)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const connectDB = require('../config/database');
const { s3Client, buildS3Url, assertS3Configured } = require('../config/s3');

const PackageRepository = require('../repositories/PackageRepository');
const DocumentRepository = require('../repositories/DocumentRepository');
const UploadJobRepository = require('../repositories/UploadJobRepository');

const { startPackageUploadConsumer } = require('../queues/packageUploadQueue');

async function processJob(jobId) {
    const job = await UploadJobRepository.findByPublicId(jobId);
    if (!job) return;
    if (job.status === 'completed' || job.status === 'processing') {
        return;
    }

    try {
        await UploadJobRepository.updateJob(jobId, {
            status: 'processing',
            progress: 10,
            startedAt: new Date(),
            errorMessage: null,
        });

        const tempFilePath = job.tempFilePath;
        if (!tempFilePath || !fs.existsSync(tempFilePath)) {
            throw new Error('Temporary file not found on server');
        }

        await UploadJobRepository.updateJob(jobId, { progress: 50 });

        const readStream = fs.createReadStream(tempFilePath);
        await s3Client.send(
            new PutObjectCommand({
                Bucket: job.s3Bucket,
                Key: job.s3Key,
                Body: readStream,
                ContentType: job.mimeType || undefined,
            })
        );

        await UploadJobRepository.updateJob(jobId, { progress: 90 });

        const storedName = path.basename(job.s3Key);
        const document = await DocumentRepository.createDocument({
            projectId: job.projectId,
            packageId: job.packageId,
            originalName: job.fileOriginalName,
            storedName,
            mimeType: job.mimeType,
            size: job.size,
            s3Bucket: job.s3Bucket,
            s3Key: job.s3Key,
            s3Url: buildS3Url(job.s3Key),
            uploadedBy: job.uploaderId,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await PackageRepository.addDocumentIdToPackage(
            job.packageId,
            job.projectId,
            document.publicId
        );

        await UploadJobRepository.updateJob(jobId, {
            status: 'completed',
            progress: 100,
            finishedAt: new Date(),
            documentPublicId: document.publicId,
            errorMessage: null,
        });

        // Dọn temp file sau khi upload S3 thành công
        fs.unlink(tempFilePath, () => {});
    } catch (err) {
        await UploadJobRepository.updateJob(jobId, {
            status: 'failed',
            progress: 100,
            finishedAt: new Date(),
            errorMessage: err?.message || 'Upload to S3 failed',
        });
        // Giữ lại temp file khi fail để debug (có thể cleanup sau)
        console.error('[packageUploadWorker] job failed:', jobId, err);
    }
}

async function main() {
    await connectDB();
    assertS3Configured();

    await startPackageUploadConsumer(async (parsed) => {
        const jobId = parsed?.jobId;
        if (!jobId) return;
        await processJob(jobId);
    });
}

main().catch((err) => {
    console.error('[packageUploadWorker] fatal error:', err);
    process.exit(1);
});

