const { S3Client } = require('@aws-sdk/client-s3');

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL; // optional (example: https://minio.example.com)

const s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT || undefined,
    forcePathStyle: S3_FORCE_PATH_STYLE,
    credentials:
        S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
            ? {
                  accessKeyId: S3_ACCESS_KEY_ID,
                  secretAccessKey: S3_SECRET_ACCESS_KEY,
              }
            : undefined,
});

function buildS3Url(s3Key) {
    if (!S3_PUBLIC_URL) return '';
    // Assumption: S3_PUBLIC_URL is base host, so url = {base}/{bucket}/{key}
    return `${S3_PUBLIC_URL.replace(/\/$/, '')}/${S3_BUCKET}/${s3Key}`;
}

function assertS3Configured() {
    if (!S3_BUCKET) {
        throw new Error('Thiếu biến môi trường S3_BUCKET');
    }
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
        throw new Error('Thiếu S3_ACCESS_KEY_ID hoặc S3_SECRET_ACCESS_KEY');
    }
}

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'supabase-s3';

module.exports = {
    s3Client,
    S3_BUCKET,
    S3_ENDPOINT,
    STORAGE_PROVIDER,
    buildS3Url,
    assertS3Configured,
};

