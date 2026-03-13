const User = require('../models/User');

class UserRepository {
    async findbyEmail(email) {
        return await User.findOne({ email });
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
}

module.exports = new UserRepository();
