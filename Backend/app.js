require('dotenv').config();
console.log('[Env] SMTP_HOST:', process.env.SMTP_HOST, '| SMTP_USER:', process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '(trống)');
console.log('[Env] Google OAuth:', process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'NOT configured (add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET to .env)');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');
const profileRoutes = require('./routes/profileRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const projectRoutes = require('./routes/projectRoutes');
const packageRoutes = require('./routes/packageRoutes');
const connectDB = require('./config/database');

const app = express();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
    },
});

app.use(express.json());
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body. Use valid JSON (e.g. {"key": "value"}). For token, use Authorization: Bearer <token> or body: {"refreshToken": "..."}.',
        });
    }
    next(err);
});
app.use(
    cors({
        origin: process.env.FRONTED_URI ,
        credentials: true,
    })
);
app.use(cookieParser());
app.use(limiter);

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api', emailRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/packages', packageRoutes);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = app;
