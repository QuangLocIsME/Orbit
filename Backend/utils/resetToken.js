const crypto = require('node:crypto');

const RESET_TOKEN_EXPIRES_MS = 15 * 60 * 1000;     // 15 phút, link dùng 1 lần

function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    generateResetToken,
    hashResetToken,
    RESET_TOKEN_EXPIRES_MS,
};
