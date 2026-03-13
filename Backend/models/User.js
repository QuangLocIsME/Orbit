const mongoose = require('mongoose');

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
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    image: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;