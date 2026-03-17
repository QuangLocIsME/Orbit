const UserRepository = require('../repositories/UserRepository');
const emailService = require('./emailService');
const {
    generateResetCode,
    generateResetToken,
    hashResetToken,
    RESET_CODE_EXPIRES_MS,
    RESET_TOKEN_EXPIRES_MS,
} = require('../utils/resetToken');
const { normalizeEmail, normalizeString, requireString } = require('../utils/sanitize');
const bcrypt = require('bcrypt');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid_password', 10);

class UserService {
    async createUser(userData) {
        const { fullName, email, password, confirmPassword, agree } = userData || {};

        const normalizedFullName = requireString(fullName, 'Full name');
        const normalizedEmail = normalizeEmail(email);
        const normalizedPassword = requireString(password, 'Password');
        const normalizedConfirmPassword = requireString(confirmPassword, 'Password confirmation');

        if (!agree) {
            throw new Error('You must accept the terms.');
        }

        if (normalizedPassword !== normalizedConfirmPassword) {
            throw new Error('Password confirmation does not match.');
        }
        const existingUser = await UserRepository.findByEmail(normalizedEmail);
        if (existingUser) {
            throw new Error('Email already exists.');
        }

        const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
        const avatarImage = userData?.avatar || userData?.image || null;
        const newUser = {
            fullName: normalizedFullName,
            email: normalizedEmail,
            password: hashedPassword,
            avatar: avatarImage,
        };

        return await UserRepository.createUser(newUser);
    }

    async loginUser(email, password) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedPassword = normalizeString(password);
        if (!normalizedEmail || !normalizedPassword) {
            throw new Error('Missing email or password.');
        }
        const user = await UserRepository.findByEmail(normalizedEmail);
        const passwordHash = user?.password;
        const isMatch = await bcrypt.compare(normalizedPassword, passwordHash || DUMMY_PASSWORD_HASH);
        if (!user || !isMatch) {
            throw new Error('Email or password is incorrect.');
        }

        if (user.isBlocked) {
            console.log('User account got banned');
            throw new Error('User account is blocked.');
        }

        const updatedUser = await UserRepository.updateLastLoginAt(user._id);
        return updatedUser || user;
    }

    /**
     * Gửi mã xác nhận qua email. Không báo lộ email có tồn tại hay không.
     */
    async requestResetCode(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            throw new Error('Email is required.');
        }

        const user = await UserRepository.findByEmail(normalizedEmail);
        if (!user) {
            return; // Không throw để không lộ thông tin
        }

        if (user.isBlocked) {
            throw new Error('Account is blocked.');
        }

        const code = generateResetCode();
        const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRES_MS);
        await UserRepository.setResetCode(user._id, code, expiresAt);
        await emailService.sendResetCodeEmail(normalizedEmail, code);
    }

    /**
     * Xác minh mã → tạo reset token dùng 1 lần, trả về link đặt lại mật khẩu.
     */
    async verifyCodeAndCreateResetToken(email, code) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedCode = normalizeString(code);
        if (!normalizedEmail || !normalizedCode) {
            throw new Error('Email and code are required.');
        }

        const user = await UserRepository.findUserByEmailAndValidResetCode(
            normalizedEmail,
            normalizedCode
        );
        if (!user) {
            throw new Error('Invalid or expired code.');
        }

        const rawToken = generateResetToken();
        const hashedToken = hashResetToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);
        await UserRepository.setResetPasswordToken(user._id, hashedToken, expiresAt);
        await UserRepository.clearResetCode(user._id);

        const baseUrl = process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321';
        const resetPasswordUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        return { resetToken: rawToken, resetPasswordUrl };
    }

    /**
     * Đặt lại mật khẩu bằng token (dùng 1 lần).
     */
    async resetPassword(token, newPassword, confirmPassword) {
        if (!token) {
            throw new Error('Reset token is required.');
        }
        if (!newPassword || !confirmPassword) {
            throw new Error('New password and confirmation are required.');
        }
        if (newPassword !== confirmPassword) {
            throw new Error('Password confirmation does not match.');
        }
        if (newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }

        const hashedToken = hashResetToken(token);
        const user = await UserRepository.findUserByResetToken(hashedToken);
        if (!user) {
            throw new Error('Invalid or expired reset link. Please request a new one.');
        }

        const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
        await UserRepository.updatePassword(user._id, hashedPassword);
        await UserRepository.clearResetPassword(user._id);
    }

    /**
     * Đặt lại mật khẩu bằng mã từ email (1 bước: email + code + newPassword + confirmPassword).
     * Dùng cho link trong email: user mở link, nhập mã + mật khẩu mới 2 lần.
     */
    async resetPasswordWithCode(email, code, newPassword, confirmPassword) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedCode = normalizeString(code);
        const normalizedPassword = normalizeString(newPassword);
        const normalizedConfirmPassword = normalizeString(confirmPassword);

        if (!normalizedEmail || !normalizedCode) {
            throw new Error('Email and code are required.');
        }
        if (!normalizedPassword || !normalizedConfirmPassword) {
            throw new Error('New password and confirmation are required.');
        }
        if (normalizedPassword !== normalizedConfirmPassword) {
            throw new Error('Password confirmation does not match.');
        }
        if (normalizedPassword.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }

        const user = await UserRepository.findUserByEmailAndValidResetCode(
            normalizedEmail,
            normalizedCode
        );
        if (!user) {
            throw new Error('Invalid or expired code. Please request a new one.');
        }

        const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
        await UserRepository.updatePassword(user._id, hashedPassword);
        await UserRepository.clearResetPassword(user._id);
    }
}

module.exports = new UserService();
