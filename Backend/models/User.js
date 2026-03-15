const mongoose = require('mongoose');
const crypto = require('crypto');

const RefreshTokenSchema = new mongoose.Schema(
    {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date, default: null },
        replacedByToken: { type: String, default: null },
    },
    { _id: false }
);

const UserSchema = new mongoose.Schema({
    publicId: {
        type: String,
        unique: true,
        index: true,
        default: () => crypto.randomUUID(),
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false, default: null },
    fullName: { type: String, required: true },
    googleId: { type: String, sparse: true, unique: true },
    avatar: { type: String, default: null },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    image: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
    // Forgot password: mã 6 số gửi qua email
    resetCode: { type: String, default: null },
    resetCodeExpiresAt: { type: Date, default: null },
    // Link đặt lại mật khẩu dùng 1 lần (lưu hash token)
    resetPasswordToken: { type: String, default: null },
    resetPasswordTokenExpiresAt: { type: Date, default: null },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;