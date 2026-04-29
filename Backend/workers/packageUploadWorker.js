const path = require('path');
const os = require('os');
const cluster = require('cluster');
// Luôn đọc .env tại thư mục Backend (kể cả khi chạy: cd workers && node packageUploadWorker.js)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');

const connectDB = require('../config/database');

const PackageRepository = require('../repositories/PackageRepository');
const DocumentRepository = require('../repositories/DocumentRepository');
const UploadJobRepository = require('../repositories/UploadJobRepository');
const UploadApprovalRepository = require('../repositories/UploadApprovalRepository');

const { startPackageUploadConsumer } = require('../queues/packageUploadQueue');
const { publishIfcConversionJob } = require('../queues/ifcConversionQueue');
const { uploadProjectFileBuffer, SUPABASE_URL } = require('../services/supabaseStorageService');
const { buildS3Url } = require('../config/s3');
const { generateUUIDv7 } = require('../utils/cryptoUtils');

function extractIfcMetadata(buffer) {
    try {
        const readSize = Math.min(buffer.length, 20 * 1024);
        const content = buffer.toString('utf8', 0, readSize);
        const result = { schema: '', projectName: '', creator: '', fileDescription: '' };

        const schemaMatch = content.match(/FILE_SCHEMA\s*\(\s*IFC([A-Za-z0-9_xX]+)/i);
        if (schemaMatch) result.schema = `IFC${schemaMatch[1].toUpperCase()}`;

        const projectNameMatch = content.match(/IFCPROJECT[^\(]*\([^\)]*NAME\s*\(\s*'([^']*)'/i);
        if (projectNameMatch) result.projectName = projectNameMatch[1].trim();

        const creatorMatch = content.match(/FILE_NAME\s*\([^,]*,\s*'([^']*)'/i);
        if (creatorMatch) result.creator = creatorMatch[1].trim();

        const descMatch = content.match(/FILE_DESCRIPTION\s*\([^)]*DESCRIPTION\s*\(\s*\(\s*'([^']*)'/i);
        if (descMatch) result.fileDescription = descMatch[1].trim();

        return result;
    } catch {
        return { schema: '', projectName: '', creator: '', fileDescription: '' };
    }
}

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

        const fileBuffer = fs.readFileSync(tempFilePath);

        // Upload to Supabase (primary storage)
        let supaFileUrl = '';
        try {
            if (job.supaFilePath) {
                const result = await uploadProjectFileBuffer(fileBuffer, job.supaFilePath);
                supaFileUrl = result.publicUrl || '';
            }
        } catch (supaErr) {
            console.warn('[packageUploadWorker] Supabase upload failed:', supaErr.message);
        }

        await UploadJobRepository.updateJob(jobId, { progress: 90 });

        const storedName = path.basename(job.supaFilePath || job.s3Key);
        const ext = path.extname(job.fileOriginalName || '').toLowerCase();
        const isIfcFile = ext === '.ifc';

        // Use version info stored on the job by the controller
        const versionGroupId = job.versionGroupId || require('crypto').randomUUID();
        const versionNumber = job.versionNumber || 1;
        const uuidv7 = job.uuidv7 || generateUUIDv7();

        const supaFilePath = job.supaFilePath
            ? job.supaFilePath
            : require('../services/supabaseStorageService').buildProjectFilePath({
                projectId: job.projectId,
                versionGroupId,
                originalName: job.fileOriginalName,
                uuidv7,
              });

        const IFC_EXTENSION = '.ifc';
        const ifcMeta = isIfcFile ? extractIfcMetadata(fileBuffer) : {};
        const jobVersionLabel = job.versionLabel || `v${versionNumber}`;
        const jobVersionDesc = job.versionDescription || '';

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
            s3Url: supaFileUrl || buildS3Url(job.s3Key),
            supabaseFileKey: supaFilePath,
            supabaseFileUrl: supaFileUrl,
            uploadedBy: job.uploaderId,
            versionGroupId,
            versionNumber,
            uuidv7,
            versionLabel: jobVersionLabel,
            versionDescription: jobVersionDesc,
            _ifcMeta: ifcMeta,
            conversionStatus: isIfcFile ? 'PENDING' : 'NOT_SUPPORTED',
            conversionAttempts: 0,
            conversionError: '',
            approvalStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await UploadApprovalRepository.create({
            projectId: job.projectId,
            documentId: document.publicId,
            packageId: job.packageId,
            jobId: job.publicId,
            uploaderId: job.uploaderId,
            originalName: job.fileOriginalName,
            mimeType: job.mimeType,
            size: job.size,
            folderType: job.folderType || 'files',
            folderPath: job.folderPath || '',
            versionGroupId,
            versionNumber,
            versionLabel: job.versionLabel || `v${versionNumber}`,
            versionDescription: job.versionDescription || '',
            isNewVersion: job.isNewVersion || false,
            status: 'pending',
            fileUrl: supaFileUrl || buildS3Url(job.s3Key),
            s3Key: job.s3Key,
            supabaseFileKey: supaFilePath,
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

    await startPackageUploadConsumer(async (parsed) => {
        const jobId = parsed?.jobId;
        if (!jobId) return;
        try {
            await processJob(jobId);
        } catch (err) {
            console.error('[packageUploadWorker] processJob error:', err);
        }
    });
}

process.on('uncaughtException', (err) => {
    console.error('[packageUploadWorker] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[packageUploadWorker] Unhandled rejection:', reason);
});

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

