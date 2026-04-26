const rateLimit = require('express-rate-limit');

const createLimiter = ({ windowMs, limit, message }) =>
    rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: {
            success: false,
            message,
        },
    });

const loginLimiter = createLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    message: 'Too many login attempts. Please try again later.',
});

const forgotPasswordLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: 'Too many password reset requests. Please try again later.',
});

module.exports = {
    loginLimiter,
    forgotPasswordLimiter,
};
