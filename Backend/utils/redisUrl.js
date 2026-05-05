function normalizeRedisUrl(rawValue) {
    const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!raw) return '';

    const shellFallbackMatch = raw.match(/^\$\{[^:}]+:-([^}]+)\}$/);
    if (shellFallbackMatch) {
        return shellFallbackMatch[1].trim();
    }

    return raw;
}

module.exports = {
    normalizeRedisUrl,
};
