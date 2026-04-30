const fs = require('fs');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_XKT_BUCKET = process.env.SUPABASE_XKT_BUCKET || 'xkt-models';
const SUPABASE_IFC_BUCKET = process.env.SUPABASE_IFC_BUCKET || 'ifc-files';
const SUPABASE_ATTACHMENT_BUCKET = process.env.SUPABASE_ATTACHMENT_BUCKET || 'orbit-files';
const SUPABASE_AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'orbit-files';
const S3_BUCKET = process.env.S3_BUCKET || 'orbit-files';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || '';
const { s3Client } = require('../config/s3');

function buildS3Url(s3Key) {
    if (!S3_PUBLIC_URL) return '';
    return `${S3_PUBLIC_URL.replace(/\/$/, '')}/${S3_BUCKET}/${s3Key}`;
}

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

/**
 * Build path cho project thumbnail trong Supabase.
 * Format: projects/{projectId}/thumbnails/{timestamp}-{safeFileName}
 */
function buildSupabaseThumbnailPath({ projectId, fileName }) {
    const safeName = (fileName || 'thumbnail')
        .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
        .replace(/\s+/g, '-')
        .substring(0, 200);
    const timestamp = Date.now();
    return `projects/${projectId}/thumbnails/${timestamp}-${safeName}`;
}

/**
 * Build path cho project avatar trong Supabase.
 * Format: projects/{projectId}/avatar/{timestamp}-{safeFileName}
 */
function buildSupabaseAvatarPath({ projectId, fileName }) {
    const safeName = (fileName || 'avatar')
        .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
        .replace(/\s+/g, '-')
        .substring(0, 200);
    const timestamp = Date.now();
    return `projects/${projectId}/avatar/${timestamp}-${safeName}`;
}

/**
 * Upload thumbnail buffer via S3-compatible API.
 */
async function uploadProjectThumbnailBuffer(buffer, storagePath) {
    assertS3Configured();
    await s3Client.send(
        new (require('@aws-sdk/client-s3').PutObjectCommand)({
            Bucket: S3_BUCKET,
            Key: storagePath,
            Body: buffer,
            ContentType: 'image/jpeg',
        })
    );
    return {
        bucket: S3_BUCKET,
        key: storagePath,
        publicUrl: buildS3Url(storagePath),
    };
}

/**
 * Upload avatar buffer via S3-compatible API.
 * Path: projects/{projectId}/avatar/{timestamp}-{safeFileName}
 */
async function uploadAvatarBuffer(buffer, storagePath) {
    assertS3Configured();
    await s3Client.send(
        new (require('@aws-sdk/client-s3').PutObjectCommand)({
            Bucket: S3_BUCKET,
            Key: storagePath,
            Body: buffer,
            ContentType: 'image/jpeg',
        })
    );
    return {
        bucket: S3_BUCKET,
        key: storagePath,
        publicUrl: buildS3Url(storagePath),
    };
}

/**
 * Xoá avatar file qua S3-compatible API.
 */
async function deleteAvatarFile(storagePath) {
    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: storagePath,
            })
        );
    } catch (err) {
        if (err.name !== 'NoSuchKey') {
            throw err;
        }
    }
}

function assertS3Configured() {
    if (!S3_BUCKET) {
        throw new Error('Missing S3_BUCKET');
    }
    if (!S3_ENDPOINT) {
        throw new Error('Missing S3_ENDPOINT');
    }
}

function buildUserAvatarPath({ userId, fileName }) {
    const safeName = (fileName || 'avatar')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/\s+/g, '-')
        .substring(0, 200);
    const timestamp = Date.now();
    return `users/${userId}/avatar/${timestamp}-${safeName}`;
}

async function uploadUserAvatarBuffer(buffer, storagePath) {
    assertSupabaseConfigured();
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_AVATAR_BUCKET}/${storagePath}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'true',
        },
        body: buffer,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase avatar upload failed: ${res.status} ${text}`);
    }
    return {
        bucket: SUPABASE_AVATAR_BUCKET,
        key: storagePath,
        publicUrl: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${SUPABASE_AVATAR_BUCKET}/${storagePath}`,
    };
}

async function deleteUserAvatarFile(storagePath) {
    if (!storagePath) return;
    try {
        const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_AVATAR_BUCKET}/${storagePath}`;
        await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: SUPABASE_SERVICE_ROLE_KEY,
            },
        });
    } catch (err) {
        console.warn('[Avatar] Delete failed:', err.message);
    }
}

/**
 * Build path cho project document file trong Supabase (orbit-files bucket, folder: files/).
 * Format: files/projects/{projectId}/{baseName}-{uuidv7}.{ext}
 *
 * uuidv7 là time-ordered: 48 bit đầu embed Unix timestamp (ms).
 * Sort file theo uuidv7 string (lexicographic) = sort theo thời gian tạo.
 *
 * @param {string} projectId
 * @param {string} versionGroupId  - dùng làm prefix cho baseName
 * @param {string} originalName     - tên gốc
 * @param {string} uuidv7          - UUIDv7 cho file này (embed timestamp)
 * @returns {string} path trong bucket, ví dụ: files/projects/{pid}/{baseName}-{uuidv7}.ext
 */
function buildProjectFilePath({ projectId, versionGroupId, originalName, uuidv7 }) {
    const ext = (originalName || 'file').split('.').pop() || '';
    const baseName = (originalName || 'file')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
        .replace(/\s+/g, '-')
        .substring(0, 200);
    const safeUuid = uuidv7 || 'unknown';
    const safeName = ext ? `${baseName}-${safeUuid}.${ext}` : `${baseName}-${safeUuid}`;
    return `files/projects/${projectId}/${safeName}`;
}

/**
 * Upload project file buffer lên Supabase Storage (bucket: orbit-files).
 * @param {Buffer} buffer - nội dung file
 * @param {string} storagePath - path trả về từ buildProjectFilePath
 * @returns {{ bucket, key, publicUrl }}
 */
async function uploadProjectFileBuffer(buffer, storagePath) {
    assertSupabaseConfigured();
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_AVATAR_BUCKET}/${storagePath}`;
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
        throw new Error(`Supabase file upload failed: ${res.status} ${text}`);
    }
    return {
        bucket: SUPABASE_AVATAR_BUCKET,
        key: storagePath,
        publicUrl: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${SUPABASE_AVATAR_BUCKET}/${storagePath}`,
    };
}

module.exports = {
    SUPABASE_XKT_BUCKET,
    SUPABASE_IFC_BUCKET,
    SUPABASE_ATTACHMENT_BUCKET,
    SUPABASE_AVATAR_BUCKET,
    SUPABASE_URL,
    buildSupabaseStoragePath,
    buildSupabaseIfcPath,
    buildSupabaseAttachmentPath,
    buildSupabaseThumbnailPath,
    buildSupabaseAvatarPath,
    buildUserAvatarPath,
    buildProjectFilePath,
    uploadXktFile,
    uploadIfcBuffer,
    downloadIfcBuffer,
    uploadAttachmentBuffer,
    uploadProjectThumbnailBuffer,
    uploadAvatarBuffer,
    uploadUserAvatarBuffer,
    uploadProjectFileBuffer,
    deleteAvatarFile,
    deleteUserAvatarFile,
    createSignedXktUrl,
    createSignedAttachmentUrl,
    assertSupabaseConfigured,
};
