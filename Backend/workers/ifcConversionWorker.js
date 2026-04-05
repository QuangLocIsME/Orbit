const path = require('path');
const os = require('os');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/database');
const DocumentRepository = require('../repositories/DocumentRepository');
const { s3Client } = require('../config/s3');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { startIfcConversionConsumer } = require('../queues/ifcConversionQueue');
const {
    buildSupabaseStoragePath,
    uploadXktFile,
    assertSupabaseConfigured,
} = require('../services/supabaseStorageService');

const TEMP_DIR = process.env.IFC_TEMP_DIR || path.join(os.tmpdir(), 'orbit-ifc-worker');
const IFC_CONVERT_COMMAND = process.env.IFC_CONVERT_COMMAND || 'npx xeokit-convert';

function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
}

async function downloadIfcToLocal({ bucket, key, targetPath }) {
    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        })
    );

    if (!response?.Body) {
        throw new Error('IFC object body is empty');
    }

    await pipeline(response.Body, fs.createWriteStream(targetPath));
}

async function runIfcConversion(inputIfcPath, outputXktPath) {
    await new Promise((resolve, reject) => {
        const command = `${IFC_CONVERT_COMMAND} -s "${inputIfcPath}" -o "${outputXktPath}"`;
        const child = spawn(command, { shell: true, stdio: 'pipe' });

        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr += chunk?.toString?.() || '';
        });

        child.on('close', (code) => {
            if (code === 0) return resolve();
            reject(new Error(stderr || `IFC convert exited with code ${code}`));
        });

        child.on('error', reject);
    });
}

async function processIfcJob(payload) {
    const versionId = payload?.versionId;
    if (!versionId) {
        console.log('[ifcConversionWorker] Skipping job: missing versionId');
        return;
    }

    console.log(`[ifcConversionWorker] Processing job for versionId: ${versionId}`);

    const doc = await DocumentRepository.findByPublicId(versionId);
    if (!doc) {
        console.log(`[ifcConversionWorker] Document not found: ${versionId}`);
        return;
    }

    console.log(`[ifcConversionWorker] Document: ${doc.originalName}, status: ${doc.conversionStatus}`);

    if (doc.conversionStatus === 'READY' && doc.xktKey) {
        console.log(`[ifcConversionWorker] Document already converted, skipping`);
        return;
    }

    await DocumentRepository.updateConversionStateByPublicId(doc.publicId, {
        conversionStatus: 'PROCESSING',
        conversionError: '',
        conversionAttempts: Number(doc.conversionAttempts || 0) + 1,
    });

    const inputIfcPath = path.join(TEMP_DIR, `${doc.publicId}-${Date.now()}.ifc`);
    const outputXktPath = path.join(TEMP_DIR, `${doc.publicId}-${Date.now()}.xkt`);

    try {
        console.log(`[ifcConversionWorker] Downloading IFC from S3: ${doc.s3Bucket}/${doc.s3Key}`);
        await downloadIfcToLocal({
            bucket: doc.s3Bucket,
            key: doc.s3Key,
            targetPath: inputIfcPath,
        });
        console.log(`[ifcConversionWorker] Download complete, running conversion`);

        await runIfcConversion(inputIfcPath, outputXktPath);
        console.log(`[ifcConversionWorker] Conversion complete, uploading to Supabase`);

        const storagePath = buildSupabaseStoragePath({
            projectId: doc.projectId,
            fileId: doc.publicId,
            versionNumber: doc.versionNumber || 1,
            originalName: doc.originalName,
        });

        const uploaded = await uploadXktFile(outputXktPath, storagePath);

        await DocumentRepository.updateConversionStateByPublicId(doc.publicId, {
            conversionStatus: 'READY',
            xktBucket: uploaded.bucket,
            xktKey: uploaded.key,
            xktUrl: uploaded.publicUrl,
            convertedAt: new Date(),
            conversionError: '',
        });
        console.log(`[ifcConversionWorker] Uploaded XKT: ${uploaded.publicUrl}`);
    } catch (error) {
        console.error(`[ifcConversionWorker] Conversion failed: ${error.message}`);
        await DocumentRepository.updateConversionStateByPublicId(doc.publicId, {
            conversionStatus: 'FAILED',
            conversionError: error?.message || 'IFC conversion failed',
        });
    } finally {
        fs.unlink(inputIfcPath, () => {});
        fs.unlink(outputXktPath, () => {});
    }
}

async function run() {
    ensureTempDir();
    assertSupabaseConfigured();
    await connectDB();

    await startIfcConversionConsumer(async (payload) => {
        await processIfcJob(payload);
    });
}

run().catch((error) => {
    console.error('[ifcConversionWorker] fatal error', error);
    process.exit(1);
});
