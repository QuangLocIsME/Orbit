const path = require('path');
const os = require('os');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');

// Self-patch @loaders.gl polyfills before any imports resolve them.
// The package uses bare `.node` extension imports that Node.js ESM cannot resolve.
(function patchLoadersGl() {
  const dir = path.join(__dirname, '..', 'node_modules', '@loaders.gl');
  if (!fs.existsSync(dir)) return;
  let patched = 0;
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); }
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const before = fs.readFileSync(full, 'utf8');
        if (!/\.node['"\/]/.test(before)) continue;
        let after = before
          .replace(/\.node\.js\./g, 'PROTECTED_NODE_JS_DOT')
          .replace(/\.node(['"\/])/g, '.node.js$1')
          .replace(/PROTECTED_NODE_JS_DOT/g, '.node.js.');
        if (after !== before) {
          fs.writeFileSync(full, after, 'utf8');
          patched++;
        }
      }
    }
  }
  walk(dir);
  if (patched > 0) console.log('[ifcConversionWorker] Patched', patched, '@loaders.gl file(s)');
})();

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/database');
const DocumentRepository = require('../repositories/DocumentRepository');
const { s3Client } = require('../config/s3');
const { startIfcConversionConsumer } = require('../queues/ifcConversionQueue');
const { publishRealtime } = require('../services/socketService');
const {
    buildSupabaseStoragePath,
    uploadXktFile,
    assertSupabaseConfigured,
    SUPABASE_URL,
    SUPABASE_AVATAR_BUCKET,
} = require('../services/supabaseStorageService');

const TEMP_DIR = process.env.IFC_TEMP_DIR || path.join(os.tmpdir(), 'orbit-ifc-worker');
const IFC_CONVERT_COMMAND = process.env.IFC_CONVERT_COMMAND || 'npx xeokit-convert';

function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
}

async function downloadIfcToLocal({ bucket, key, targetPath }) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');

    const S3_BUCKET = process.env.S3_BUCKET || 'orbit-files';

    let normalizedBucket = bucket;
    let normalizedKey = key;

    if (typeof normalizedKey === 'string' && normalizedKey.startsWith('http')) {
        try {
            const parsed = new URL(normalizedKey);
            const segments = parsed.pathname.split('/');
            const bucketIdx = segments.indexOf('orbit-files');
            if (bucketIdx >= 0 && bucketIdx < segments.length - 1) {
                normalizedBucket = 'orbit-files';
                normalizedKey = segments.slice(bucketIdx + 1).join('/');
            } else {
                const altIdx = segments.indexOf(S3_BUCKET);
                if (altIdx >= 0 && altIdx < segments.length - 1) {
                    normalizedBucket = S3_BUCKET;
                    normalizedKey = segments.slice(altIdx + 1).join('/');
                }
            }
        } catch (_) {}
    }

    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: normalizedBucket,
            Key: normalizedKey,
        })
    );

    if (!response?.Body) {
        throw new Error('IFC object body is empty');
    }

    await pipeline(response.Body, fs.createWriteStream(targetPath));
}

async function downloadIfcFromSupabase(supabaseFileKey, targetPath) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let normalizedKey = supabaseFileKey;
    if (normalizedKey.startsWith('http')) {
        try {
            const parsed = new URL(normalizedKey);
            const segments = parsed.pathname.split('/');
            const bucketIdx = segments.indexOf(SUPABASE_AVATAR_BUCKET);
            if (bucketIdx >= 0 && bucketIdx < segments.length - 1) {
                normalizedKey = segments.slice(bucketIdx + 1).join('/');
            }
        } catch (_) {}
    }

    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_AVATAR_BUCKET}/${normalizedKey}`;
    const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase IFC download failed: ${res.status} ${text}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
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
    await publishRealtime({
        target: 'project',
        id: doc.projectId,
        event: 'document:conversion-updated',
        data: {
            projectId: doc.projectId,
            packageId: doc.packageId || null,
            documentId: payload.documentId || doc.publicId,
            versionId: doc.publicId,
            status: 'PROCESSING',
            conversionStatus: 'PROCESSING',
        },
    });

    const inputIfcPath = path.join(TEMP_DIR, `${doc.publicId}-${Date.now()}.ifc`);
    const outputXktPath = path.join(TEMP_DIR, `${doc.publicId}-${Date.now()}.xkt`);

    try {
        if (doc.supabaseFileKey) {
            console.log(`[ifcConversionWorker] Downloading IFC from Supabase: ${SUPABASE_AVATAR_BUCKET}/${doc.supabaseFileKey}`);
            await downloadIfcFromSupabase(doc.supabaseFileKey, inputIfcPath);
        } else {
            console.log(`[ifcConversionWorker] Downloading IFC from S3: ${doc.s3Bucket}/${doc.s3Key}`);
            await downloadIfcToLocal({
                bucket: doc.s3Bucket,
                key: doc.s3Key,
                targetPath: inputIfcPath,
            });
        }
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
        await publishRealtime({
            target: 'project',
            id: doc.projectId,
            event: 'document:conversion-updated',
            data: {
                projectId: doc.projectId,
                packageId: doc.packageId || null,
                documentId: payload.documentId || doc.publicId,
                versionId: doc.publicId,
                status: 'READY',
                conversionStatus: 'READY',
                xktUrl: uploaded.publicUrl,
            },
        });
        console.log(`[ifcConversionWorker] Uploaded XKT: ${uploaded.publicUrl}`);
    } catch (error) {
        console.error(`[ifcConversionWorker] Conversion failed: ${error.message}`);
        await DocumentRepository.updateConversionStateByPublicId(doc.publicId, {
            conversionStatus: 'FAILED',
            conversionError: error?.message || 'IFC conversion failed',
        });
        await publishRealtime({
            target: 'project',
            id: doc.projectId,
            event: 'document:conversion-updated',
            data: {
                projectId: doc.projectId,
                packageId: doc.packageId || null,
                documentId: payload.documentId || doc.publicId,
                versionId: doc.publicId,
                status: 'FAILED',
                conversionStatus: 'FAILED',
                conversionError: error?.message || 'IFC conversion failed',
            },
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

process.on('uncaughtException', (err) => {
    console.error('[ifcConversionWorker] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ifcConversionWorker] Unhandled rejection:', reason);
});

run().catch((error) => {
    console.error('[ifcConversionWorker] fatal error', error);
    process.exit(1);
});
