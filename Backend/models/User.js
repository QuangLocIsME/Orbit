const mongoose = require('mongoose');
const crypto = require('node:crypto');

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
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u, 'Invalid email format'],
    },
    password: { type: String, required: false, default: null, minlength: 6 },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    googleId: { type: String, sparse: true, unique: true, match: [/^\d+$/, 'Invalid Google ID'] },
    avatar: { type: String, default: null, trim: true },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
    // Forgot password: mã 6 số gửi qua email (lưu hash)
    resetCode: { type: String, default: null },
    resetCodeExpiresAt: { type: Date, default: null },
    // Link đặt lại mật khẩu dùng 1 lần (lưu hash token)
    resetPasswordToken: { type: String, default: null },
    resetPasswordTokenExpiresAt: { type: Date, default: null },
});

UserSchema.pre('save', async function () {
    this.updatedAt = new Date();
});

const User = mongoose.model('User', UserSchema);

module.exports = User;