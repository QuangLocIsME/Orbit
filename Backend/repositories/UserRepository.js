const User = require('../models/User');
const { hashToken } = require('../utils/tokenHash');
const { validateEmail, validateObjectId, validateGoogleId } = require('../utils/validators');

const MAX_REFRESH_TOKENS = 8;

class UserRepository {
    async findByEmail(email) {
        const normalizedEmail = validateEmail(email);
        if (!normalizedEmail) return null;
        return await User.findOne({ email: normalizedEmail });
    }

    async findByGoogleId(googleId) {
        const normalizedGoogleId = validateGoogleId(googleId);
        if (!normalizedGoogleId) return null;
        return await User.findOne({ googleId: normalizedGoogleId });
    }

    async createUser(user) {
        const allowedFields = {
            fullName: user?.fullName,
            email: validateEmail(user?.email),
            password: user?.password ?? null,
            googleId: validateGoogleId(user?.googleId) || undefined,
            avatar: user?.avatar ?? null,
            provider: user?.provider,
            isVerified: user?.isVerified,
            isActive: user?.isActive,
            isBlocked: user?.isBlocked,
        };
        const newUser = new User(allowedFields);
        return await newUser.save();
    }

    async updateLastLoginAt(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            { lastLoginAt: new Date(), updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async linkGoogleAccount(userId, googleId, avatar) {
        const normalizedUserId = validateObjectId(userId);
        const normalizedGoogleId = validateGoogleId(googleId);
        if (!normalizedUserId || !normalizedGoogleId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                googleId: normalizedGoogleId,
                avatar: avatar || null,
                provider: 'google',
                isVerified: true,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async findById(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findById(normalizedUserId);
    }

    async addRefreshToken(userId, refreshToken) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId || !refreshToken) return null;
        const hashedToken = hashToken(refreshToken.token);
        if (!hashedToken) return null;
        const record = { ...refreshToken, token: hashedToken };
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                $push: { refreshTokens: { $each: [record], $slice: -MAX_REFRESH_TOKENS } },
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async setSingleRefreshToken(userId, refreshToken) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId || !refreshToken) return null;
        const hashedToken = hashToken(refreshToken.token);
        if (!hashedToken) return null;
        const record = { ...refreshToken, token: hashedToken };
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                $set: { refreshTokens: [record], updatedAt: new Date() },
            },
            { returnDocument: 'after' }
        );
    }

    async revokeRefreshToken(userId, token, replacedByToken = null) {
        const normalizedUserId = validateObjectId(userId);
        const hashedToken = hashToken(token);
        const hashedReplacement = replacedByToken ? hashToken(replacedByToken) : null;
        if (!normalizedUserId || !hashedToken) return null;
        return await User.updateOne(
            { _id: normalizedUserId, 'refreshTokens.token': hashedToken },
            {
                $set: {
                    'refreshTokens.$.revokedAt': new Date(),
                    'refreshTokens.$.replacedByToken': hashedReplacement,
                    updatedAt: new Date(),
                },
            }
        );
    }

    async findUserByRefreshToken(token) {
        const hashedToken = hashToken(token);
        if (!hashedToken) return null;
        return await User.findOne({ 'refreshTokens.token': hashedToken });
    }

    async getActiveRefreshToken(userId, token) {
        const normalizedUserId = validateObjectId(userId);
        const hashedToken = hashToken(token);
        if (!normalizedUserId || !hashedToken) return null;
        return await User.findOne({
            _id: normalizedUserId,
            refreshTokens: {
                $elemMatch: {
                    token: hashedToken,
                    revokedAt: null,
                    expiresAt: { $gt: new Date() },
                },
            },
        });
    }

    async revokeAllRefreshTokens(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.updateOne(
            { _id: normalizedUserId },
            {
                $set: {
                    'refreshTokens.$[token].revokedAt': new Date(),
                    updatedAt: new Date(),
                },
            },
            {
                arrayFilters: [{ 'token.revokedAt': null }],
            }
        );
    }

    async removeExpiredRefreshTokens(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.updateOne(
            { _id: normalizedUserId },
            {
                $pull: {
                    refreshTokens: { expiresAt: { $lte: new Date() } },
                },
                $set: { updatedAt: new Date() },
            }
        );
    }

    // --- Forgot password: mã xác nhận qua email ---
    async setResetCode(userId, code, expiresAt) {
        const normalizedUserId = validateObjectId(userId);
        const hashedCode = hashToken(code);
        if (!normalizedUserId || !hashedCode) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                resetCode: hashedCode,
                resetCodeExpiresAt: expiresAt,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async findUserByEmailAndValidResetCode(email, code) {
        const normalizedEmail = validateEmail(email);
        const hashedCode = hashToken(code);
        if (!normalizedEmail || !hashedCode) return null;
        const now = new Date();
        return await User.findOne({
            email: normalizedEmail,
            resetCode: hashedCode,
            resetCodeExpiresAt: { $gt: now },
        });
    }

    // --- Reset password: token dùng 1 lần (lưu hash) ---
    async setResetPasswordToken(userId, rawToken, expiresAt) {
        const normalizedUserId = validateObjectId(userId);
        const hashedToken = hashToken(rawToken);
        if (!normalizedUserId || !hashedToken) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                resetPasswordToken: hashedToken,
                resetPasswordTokenExpiresAt: expiresAt,
                resetCode: null,
                resetCodeExpiresAt: null,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async findUserByResetToken(rawToken) {
        const hashedToken = hashToken(rawToken);
        if (!hashedToken) return null;
        const now = new Date();
        return await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordTokenExpiresAt: { $gt: now },
        });
    }

    async clearResetPassword(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                resetCode: null,
                resetCodeExpiresAt: null,
                resetPasswordToken: null,
                resetPasswordTokenExpiresAt: null,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async clearResetCode(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                resetCode: null,
                resetCodeExpiresAt: null,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async updatePassword(userId, hashedPassword) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                password: hashedPassword,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async getProfileById(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findById(normalizedUserId).select(
            '-_id -role -updatedAt -refreshTokens -isBlocked -password'
        );
    }

    async getProfileByPublicId(publicId) {
        const normalizedPublicId = typeof publicId === 'string' ? publicId.trim() : '';
        if (!normalizedPublicId) return null;
        return await User.findOne({ publicId: normalizedPublicId }).select(
            '-_id -role -updatedAt -refreshTokens -isBlocked -password'
        );
    }

    // --- Brute force protection: login attempts ---
    async incrementLoginAttempts(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                $inc: { loginAttempts: 1 },
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async resetLoginAttempts(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findByIdAndUpdate(
            normalizedUserId,
            {
                $set: { loginAttempts: 0, lockUntil: null },
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async getLockStatus(userId) {
        const normalizedUserId = validateObjectId(userId);
        if (!normalizedUserId) return null;
        return await User.findById(normalizedUserId).select('loginAttempts lockUntil');
    }
}

module.exports = new UserRepository();
