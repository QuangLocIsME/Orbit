const { normalizeEmail, normalizeString } = require('./sanitize');
const mongoose = require('mongoose');

const validateEmail = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
    return emailRegex.test(normalized) ? normalized : '';
};

const validateObjectId = (value) => {
    const candidate =
        typeof value === 'string'
            ? value
            : value && typeof value.toString === 'function'
              ? value.toString()
              : '';

    const normalized = normalizeString(candidate);
    if (!normalized) return '';
    return mongoose.Types.ObjectId.isValid(normalized) ? normalized : '';
};

const validateGoogleId = (googleId) => {
    const normalized = normalizeString(googleId);
    if (!normalized) return '';
    return /^\d+$/.test(normalized) ? normalized : '';
};

module.exports = {
    validateEmail,
    validateObjectId,
    validateGoogleId,
};
