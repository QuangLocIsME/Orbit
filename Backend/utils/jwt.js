const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in environment variables');
}

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const ACCESS_TOKEN_EXPIRES_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

const signAccessToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

const signRefreshToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        jwtid: crypto.randomUUID(),
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyToken,
    JWT_SECRET,
    ACCESS_TOKEN_EXPIRES_MS,
    REFRESH_TOKEN_EXPIRES_MS,
};
