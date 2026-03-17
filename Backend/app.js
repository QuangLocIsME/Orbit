require('dotenv').config();

if (process.env.NODE_ENV !== 'production') {
    console.info('[Env] SMTP_HOST:', process.env.SMTP_HOST ? '[set]' : '[missing]');
    console.info('[Env] SMTP_USER:', process.env.SMTP_USER ? '[set]' : '[missing]');
    console.info('[Env] Google OAuth:', process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'NOT configured (add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET to .env)');
}

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
app.use(
    cors({
        origin: process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321',
        credentials: true,
    })
);
app.use(cookieParser());
app.use(limiter);

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/projects', projectRoutes);

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body. Use valid JSON (e.g. {"key": "value"}). For token, use Authorization: Bearer <token> or body: {"refreshToken": "..."}.',
        });
    }
    return res.status(500).json({
        success: false,
        message: 'Internal server error',
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = app;
