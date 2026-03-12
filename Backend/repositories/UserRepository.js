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
    const vietnamTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));

        return await User.findByIdAndUpdate(
            userId,
            { lastLoginAt: vietnamTime },
            { returnDocument: 'after' }
        );
    }
}

module.exports = new UserRepository();
