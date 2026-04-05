const path = require('path');
const os = require('os');
const cluster = require('cluster');
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
const { publishIfcConversionJob } = require('../queues/ifcConversionQueue');

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
        const ext = path.extname(job.fileOriginalName || '').toLowerCase();
        const isIfcFile = ext === '.ifc';
        const document = await DocumentRepository.createDocument({
            projectId: job.projectId,
            packageId: job.packageId,
            folderType: job.folderType || 'files',
            folderPath: job.folderPath || '',
            originalName: job.fileOriginalName,
            storedName,
            mimeType: job.mimeType,
            size: job.size,
            s3Bucket: job.s3Bucket,
            s3Key: job.s3Key,
            s3Url: buildS3Url(job.s3Key),
            uploadedBy: job.uploaderId,
            versionGroupId: require('crypto').randomUUID(),
            versionNumber: 1,
            conversionStatus: isIfcFile ? 'PENDING' : 'NOT_SUPPORTED',
            conversionAttempts: 0,
            conversionError: '',
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

        if (isIfcFile) {
            await publishIfcConversionJob({
                projectId: job.projectId,
                documentId: document.publicId,
                versionId: document.publicId,
                ifcS3Bucket: document.s3Bucket,
                ifcS3Key: document.s3Key,
                requestedBy: job.uploaderId,
            });
        }

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

async function runConsumer() {
    await connectDB();
    assertS3Configured();

    await startPackageUploadConsumer(async (parsed) => {
        const jobId = parsed?.jobId;
        if (!jobId) return;
        await processJob(jobId);
    });
}

function startWorkerCluster() {
    const cpuCount = os.cpus()?.length || 1;
    const workerCount = Number(process.env.UPLOAD_WORKER_THREADS || Math.min(Math.max(cpuCount - 1, 1), 4));

    if (cluster.isPrimary) {
        console.log(`[packageUploadWorker] primary ${process.pid} starting ${workerCount} workers`);
        for (let i = 0; i < workerCount; i += 1) {
            cluster.fork();
        }

        cluster.on('exit', (worker, code, signal) => {
            console.error(`[packageUploadWorker] worker ${worker.process.pid} exited (code=${code}, signal=${signal}). restarting...`);
            cluster.fork();
        });
        return;
    }

    runConsumer().catch((err) => {
        console.error(`[packageUploadWorker] worker ${process.pid} fatal error:`, err);
        process.exit(1);
    });
}

startWorkerCluster();

