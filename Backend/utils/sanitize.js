const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const requireString = (value, fieldName) => {
    const normalized = normalizeString(value);
    if (!normalized) {
        throw new Error(`${fieldName} is required.`);
    }
    return normalized;
};

module.exports = {
    normalizeString,
    normalizeEmail,
    requireString,
};
