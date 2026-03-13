const UserRepository = require('../repositories/UserRepository');
const bcrypt = require('bcrypt');

class UserService {
    async createUser(userData) {
        const { fullName, email, password, confirmPassword, agree } = userData || {};

        if (!fullName || !email || !password || !confirmPassword) {
            throw new Error('Missing required fields.');
        }

        if (!agree) {
            throw new Error('You must accept the terms.');
        }

        if (password !== confirmPassword) {
            throw new Error('Password confirmation does not match.');
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await UserRepository.findbyEmail(normalizedEmail);
        if (existingUser) {
            throw new Error('Email already exists.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            fullName,
            email: normalizedEmail,
            password: hashedPassword,
        };

        return await UserRepository.createUser(newUser);
    }

    async loginUser(email, password) {
        if (!email || !password) {
            throw new Error('Missing email or password.');
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await UserRepository.findbyEmail(normalizedEmail);
        if (!user) {
            throw new Error('Email or password is incorrect.');
        }

        if (user.isBlocked) {
            console.log('User account got banned');
            throw new Error('User account is blocked.');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Email or password is incorrect.');
        }

        const updatedUser = await UserRepository.updateLastLoginAt(user._id);
        return updatedUser || user;
    }
}

module.exports = new UserService();
