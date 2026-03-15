const crypto = require('crypto');

const RESET_CODE_EXPIRES_MS = 15 * 60 * 1000;      // 15 phút
const RESET_TOKEN_EXPIRES_MS = 15 * 60 * 1000;     // 15 phút, link dùng 1 lần

function generateResetCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function getFrontendBaseUrl() {
    return process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321';
}

function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    generateResetCode,
    generateResetToken,
    hashResetToken,
    getFrontendBaseUrl,
    RESET_CODE_EXPIRES_MS,
    RESET_TOKEN_EXPIRES_MS,
};
