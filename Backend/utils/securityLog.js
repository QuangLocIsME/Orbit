const logSecurityEvent = (event, meta = {}) => {
    const entry = {
        event,
        ...meta,
        timestamp: new Date().toISOString(),
    };
    console.warn('[SecurityEvent]', JSON.stringify(entry));
};

module.exports = {
    logSecurityEvent,
};
