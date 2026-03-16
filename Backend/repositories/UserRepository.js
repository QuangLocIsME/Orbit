const User = require('../models/User');

class UserRepository {
    async findByEmail(email) {
        return await User.findOne({ email: (email || '').toLowerCase().trim() });
    }

    async findByGoogleId(googleId) {
        return await User.findOne({ googleId });
    }

    async createUser(user) {
        const newUser = new User(user);
        return await newUser.save();
    }

    async updateLastLoginAt(userId) {
        return await User.findByIdAndUpdate(
            userId,
            { lastLoginAt: new Date(), updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async findById(userId) {
        return await User.findById(userId);
    }

    async addRefreshToken(userId, refreshToken) {
        return await User.findByIdAndUpdate(
            userId,
            {
                $push: { refreshTokens: refreshToken },
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async setSingleRefreshToken(userId, refreshToken) {
        return await User.findByIdAndUpdate(
            userId,
            {
                $set: { refreshTokens: [refreshToken], updatedAt: new Date() },
            },
            { returnDocument: 'after' }
        );
    }

    async revokeRefreshToken(userId, token, replacedByToken = null) {
        return await User.updateOne(
            { _id: userId, 'refreshTokens.token': token },
            {
                $set: {
                    'refreshTokens.$.revokedAt': new Date(),
                    'refreshTokens.$.replacedByToken': replacedByToken,
                    updatedAt: new Date(),
                },
            }
        );
    }

    async findUserByRefreshToken(token) {
        return await User.findOne({ 'refreshTokens.token': token });
    }

    async getActiveRefreshToken(userId, token) {
        return await User.findOne({
            _id: userId,
            refreshTokens: {
                $elemMatch: {
                    token,
                    revokedAt: null,
                    expiresAt: { $gt: new Date() },
                },
            },
        });
    }

    async revokeAllRefreshTokens(userId) {
        return await User.updateOne(
            { _id: userId },
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
        return await User.updateOne(
            { _id: userId },
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
        return await User.findByIdAndUpdate(
            userId,
            {
                resetCode: code,
                resetCodeExpiresAt: expiresAt,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async findUserByEmailAndValidResetCode(email, code) {
        const now = new Date();
        return await User.findOne({
            email: email.toLowerCase().trim(),
            resetCode: code,
            resetCodeExpiresAt: { $gt: now },
        });
    }

    // --- Reset password: token dùng 1 lần (lưu hash) ---
    async setResetPasswordToken(userId, hashedToken, expiresAt) {
        return await User.findByIdAndUpdate(
            userId,
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

    async findUserByResetToken(hashedToken) {
        const now = new Date();
        return await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordTokenExpiresAt: { $gt: now },
        });
    }

    async clearResetPassword(userId) {
        return await User.findByIdAndUpdate(
            userId,
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
        return await User.findByIdAndUpdate(
            userId,
            {
                resetCode: null,
                resetCodeExpiresAt: null,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async updatePassword(userId, hashedPassword) {
        return await User.findByIdAndUpdate(
            userId,
            {
                password: hashedPassword,
                updatedAt: new Date(),
            },
            { returnDocument: 'after' }
        );
    }

    async getProfileById(userId) {
        return await User.findById(userId).select(
            '-_id -role -updatedAt -refreshTokens -isBlocked -password'
        );
    }

    async getProfileByPublicId(publicId) {
        return await User.findOne({ publicId }).select(
            '-_id -role -updatedAt -refreshTokens -isBlocked -password'
        );
    }
}

module.exports = new UserRepository();
