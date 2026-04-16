const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_XKT_BUCKET = process.env.SUPABASE_XKT_BUCKET || 'xkt-models';
const SUPABASE_IFC_BUCKET = process.env.SUPABASE_IFC_BUCKET || 'ifc-files';
const SUPABASE_ATTACHMENT_BUCKET = process.env.SUPABASE_ATTACHMENT_BUCKET || 'cr-attachments';

function assertSupabaseConfigured() {
    if (!SUPABASE_URL) {
        throw new Error('Missing SUPABASE_URL');
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }
}

function buildSupabaseStoragePath({ projectId, fileId, versionNumber, originalName }) {
    const baseName = (originalName || 'model')
        .replace(/\.ifc$/i, '')
        .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
        .replace(/\s+/g, '-');
    return `projects/${projectId}/documents/${fileId}/v${versionNumber || 1}/${baseName}.xkt`;
}

async function uploadXktFile(localPath, storagePath) {
    assertSupabaseConfigured();

    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_XKT_BUCKET}/${storagePath}`;
    const data = fs.readFileSync(localPath);

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/octet-stream',
            'x-upsert': 'true',
        },
        body: data,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase upload failed: ${res.status} ${text}`);
    }

    return {
        bucket: SUPABASE_XKT_BUCKET,
        key: storagePath,
        publicUrl: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${SUPABASE_XKT_BUCKET}/${storagePath}`,
    };
}

async function createSignedXktUrl(storagePath, expiresIn = 3600) {
    assertSupabaseConfigured();

    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${SUPABASE_XKT_BUCKET}/${storagePath}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase sign URL failed: ${res.status} ${text}`);
    }

    const payload = await res.json();
    const signedPath = payload?.signedURL || payload?.signedUrl;
    if (!signedPath) {
        throw new Error('Supabase signed URL response invalid');
    }

    return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1${signedPath}`;
}

/**
 * Supabase path cho IFC file gốc.
 * Format: projects/{projectId}/ifc/{documentId}/{originalName}
 */
function buildSupabaseIfcPath({ projectId, documentId, originalName }) {
    const safeName = (originalName || 'model.ifc').replace(/[^a-zA-Z0-9_\-. ]/g, '-').replace(/\s+/g, '-');
    return `projects/${projectId}/ifc/${documentId}/${safeName}`;
}

/**
 * Upload IFC buffer lên Supabase Storage (bucket: ifc-files).
 * @param {Buffer} buffer - nội dung file IFC
 * @param {string} storagePath - path trả về từ buildSupabaseIfcPath
 */
async function uploadIfcBuffer(buffer, storagePath) {
    assertSupabaseConfigured();
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_IFC_BUCKET}/${storagePath}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/octet-stream',
            'x-upsert': 'true',
        },
        body: buffer,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase IFC upload failed: ${res.status} ${text}`);
    }
    return { bucket: SUPABASE_IFC_BUCKET, key: storagePath };
}

/**
 * Download IFC file từ Supabase, trả về Buffer.
 * @param {string} storagePath - supabaseIfcKey đã lưu trong Document
 */
async function downloadIfcBuffer(storagePath) {
    assertSupabaseConfigured();
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_IFC_BUCKET}/${storagePath}`;
    const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase IFC download failed: ${res.status} ${text}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Build path cho CR attachment trong Supabase.
 * Format: projects/{projectId}/attachments/{publicId}/{safeFileName}
 */
function buildSupabaseAttachmentPath({ projectId, crId, fileName }) {
    const safeName = (fileName || 'file')
        .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
        .replace(/\s+/g, '-')
        .substring(0, 200);
    return `projects/${projectId}/attachments/${crId}/${safeName}`;
}

/**
 * Upload attachment buffer lên Supabase Storage (bucket: cr-attachments).
 * @param {Buffer} buffer - nội dung file
 * @param {string} storagePath - path trả về từ buildSupabaseAttachmentPath
 */
async function uploadAttachmentBuffer(buffer, storagePath) {
    assertSupabaseConfigured();
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_ATTACHMENT_BUCKET}/${storagePath}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/octet-stream',
            'x-upsert': 'true',
        },
        body: buffer,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase attachment upload failed: ${res.status} ${text}`);
    }
    return {
        bucket: SUPABASE_ATTACHMENT_BUCKET,
        key: storagePath,
        publicUrl: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${SUPABASE_ATTACHMENT_BUCKET}/${storagePath}`,
    };
}

/**
 * Tạo signed URL cho attachment để tải về (hạn 1 giờ).
 * @param {string} storagePath
 * @param {number} expiresIn - giây
 */
async function createSignedAttachmentUrl(storagePath, expiresIn = 3600) {
    assertSupabaseConfigured();
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${SUPABASE_ATTACHMENT_BUCKET}/${storagePath}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase signed attachment URL failed: ${res.status} ${text}`);
    }
    const payload = await res.json();
    const signedPath = payload?.signedURL || payload?.signedUrl;
    if (!signedPath) {
        throw new Error('Supabase signed attachment URL response invalid');
    }
    return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1${signedPath}`;
}

module.exports = {
    SUPABASE_XKT_BUCKET,
    SUPABASE_IFC_BUCKET,
    SUPABASE_ATTACHMENT_BUCKET,
    buildSupabaseStoragePath,
    buildSupabaseIfcPath,
    buildSupabaseAttachmentPath,
    uploadXktFile,
    uploadIfcBuffer,
    downloadIfcBuffer,
    uploadAttachmentBuffer,
    createSignedXktUrl,
    createSignedAttachmentUrl,
    assertSupabaseConfigured,
};
