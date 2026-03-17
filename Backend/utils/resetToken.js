const crypto = require('node:crypto');

const RESET_CODE_LENGTH = 6;
const RESET_CODE_EXPIRES_MS = 15 * 60 * 1000;      // 15 phút
const RESET_TOKEN_EXPIRES_MS = 15 * 60 * 1000;     // 15 phút, link dùng 1 lần

function generateResetCode() {
    let code = '';
    for (let i = 0; i < RESET_CODE_LENGTH; i++) {
        code += crypto.randomInt(0, 10).toString();
    }
    return code;
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
    RESET_CODE_EXPIRES_MS,
    RESET_TOKEN_EXPIRES_MS,
};
