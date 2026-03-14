const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
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
        origin: process.env.FRONTED_URI ,
        credentials: true,
    })
);
app.use(cookieParser());
app.use(limiter);

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/projects', projectRoutes);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = app;
