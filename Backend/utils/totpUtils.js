const crypto = require('node:crypto');

function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    str = str.toUpperCase().replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const output = [];

    for (const char of str) {
        const v = alphabet.indexOf(char);
        if (v === -1) continue;
        value = (value << 5) | v;
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            output.push((value >>> bits) & 0xff);
        }
    }
    return Buffer.from(output);
}

function generateTOTPCode(secret, timeStep) {
    const key = base32Decode(secret);
    const counter = Math.floor(timeStep);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const h = hmac.digest();
    const offset = h[h.length - 1] & 0xf;
    const code = (
        ((h[offset] & 0x7f) << 24) |
        ((h[offset + 1] & 0xff) << 16) |
        ((h[offset + 2] & 0xff) << 8) |
        (h[offset + 3] & 0xff)
    ) % 1000000;
    return String(code).padStart(6, '0');
}

function verifyTOTP(secret, token, window = 1) {
    const currentTime = Math.floor(Date.now() / 1000 / 30);
    for (let i = -window; i <= window; i++) {
        if (generateTOTPCode(secret, currentTime + i) === token) {
            return true;
        }
    }
    return false;
}

module.exports = { generateTOTPCode, verifyTOTP };
