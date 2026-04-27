const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
    const key = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
    return crypto.createHash('sha256').update(key || 'orbit-default-key').digest();
}

function encryptSecret(plaintext) {
    if (!plaintext) return null;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decryptSecret(encryptedData) {
    if (!encryptedData) return null;
    try {
        const key = getEncryptionKey();
        const [ivHex, tagHex, encrypted] = encryptedData.split(':');
        if (!ivHex || !tagHex || !encrypted) return null;
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        return null;
    }
}

function hashToken(token) {
    if (!token) return '';
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Generates a UUIDv7 (time-ordered UUID).
 * 48 bits of timestamp (milliseconds since Unix epoch) + 80 random bits.
 * Lexicographic sort order of UUIDv7 strings equals chronological order.
 */
function generateUUIDv7() {
    const now = Date.now();
    const nowHex = now.toString(16).padStart(12, '0');
    const randomHex = crypto.randomBytes(10).toString('hex');
    const uuid = [
        nowHex.slice(0, 8),
        nowHex.slice(8, 12),
        '7' + randomHex.slice(0, 3),
        ((parseInt(randomHex.slice(3, 5), 16) & 0x3f) | 0x80).toString(16) + randomHex.slice(5, 8),
        randomHex.slice(8, 20),
    ].join('-');
    return uuid;
}

module.exports = {
    hashToken,
    encryptSecret,
    decryptSecret,
    generateUUIDv7,
};
