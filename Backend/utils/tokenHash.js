const crypto = require('node:crypto');

const hashToken = (token) => {
    if (!token) return '';
    return crypto.createHash('sha256').update(String(token)).digest('hex');
};

module.exports = {
    hashToken,
};
