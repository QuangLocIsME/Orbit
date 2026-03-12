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
            { new: true }
        );
    }
}

module.exports = new UserRepository();
