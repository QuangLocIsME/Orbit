require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

if (process.env.NODE_ENV !== 'production') {
    console.info('[Env] SMTP_HOST:', process.env.SMTP_HOST ? '[set]' : '[missing]');
    console.info('[Env] SMTP_USER:', process.env.SMTP_USER ? '[set]' : '[missing]');
    console.info('[Env] Google OAuth:', process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 'configured' : 'NOT configured (add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET to .env)');
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');
const profileRoutes = require('./routes/profileRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const folderRoutes = require('./routes/folderRoutes');
const projectRoutes = require('./routes/projectRoutes');
const packageRoutes = require('./routes/packageRoutes');
const teamRoutes = require('./routes/teamRoutes');
const taskRoutes = require('./routes/taskRoutes');
const wsRoutes = require('./routes/wsRoutes');
const clashRoutes = require('./routes/clash.routes');
const navisworksRoutes = require('./routes/navisworks.routes');
const changeRequestRoutes = require('./routes/changeRequest.routes');
const disciplineRoutes = require('./routes/discipline.routes');
const connectDB = require('./config/database');
const { attachSocket } = require('./services/socketService');

const app = express();
const httpServer = http.createServer(app);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
    },
    skip: (req) => req.path.includes('/clashes') || req.path.includes('/clash-detect'),
});

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const clashLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many clash detection requests, please slow down.',
    },
    skip: () => !IS_PRODUCTION,
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
attachSocket(httpServer);

app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/packages', packageRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ws', wsRoutes);
app.use('/api', clashLimiter, clashRoutes);
app.use('/api', clashLimiter, navisworksRoutes);
app.use('/api', changeRequestRoutes);
app.use('/api', disciplineRoutes);

app.use((err, req, res, nextHandler) => {
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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, httpServer };
