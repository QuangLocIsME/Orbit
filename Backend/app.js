require('dotenv').config();
console.log('[Env] SMTP_HOST:', process.env.SMTP_HOST, '| SMTP_USER:', process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : '(trống)');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');
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
        origin: process.env.FRONTED_URI ,
        credentials: true,
    })
);
app.use(cookieParser());
app.use(limiter);

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api', emailRoutes);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = app;
