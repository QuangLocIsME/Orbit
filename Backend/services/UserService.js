const UserRepository = require('../repositories/UserRepository');
const emailService = require('./emailService');
const {
    generateResetToken,
    RESET_TOKEN_EXPIRES_MS,
} = require('../utils/resetToken');
const { normalizeEmail, normalizeString, requireString } = require('../utils/sanitize');
const { validateEmail } = require('../utils/validators');
const { logSecurityEvent } = require('../utils/securityLog');
const bcrypt = require('bcrypt');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid_password', 10);

const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

const validatePasswordStrength = (password) => {
    const errors = [];
    if (!password || typeof password !== 'string') {
        errors.push('Password is required.');
        return { valid: false, errors };
    }
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters.');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character.');
    }
    return { valid: errors.length === 0, errors };
};

const checkAccountLock = (user) => {
    if (!user) return;
    if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / 60000);
        throw new Error(`Account is locked. Try again in ${remainingMinutes} minute(s).`);
    }
};

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

        const strength = validatePasswordStrength(normalizedPassword);
        if (!strength.valid) {
            throw new Error(strength.errors.join(' '));
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
        const normalizedEmail = validateEmail(email);
        const normalizedPassword = normalizeString(password);
        if (!normalizedEmail || !normalizedPassword) {
            logSecurityEvent('auth.login.missing_credentials', { email: normalizedEmail || 'unknown' });
            throw new Error('Email or password is incorrect.');
        }
        const user = await UserRepository.findByEmail(normalizedEmail);

        if (user) {
            UserService.checkAccountLock(user);

            if (user.isBlocked === true) {
                logSecurityEvent('auth.login.blocked', { userId: user._id, email: user.email });
                throw new Error('User account is blocked.');
            }

            const passwordHash = user?.password;
            const isMatch = await bcrypt.compare(normalizedPassword, passwordHash || DUMMY_PASSWORD_HASH);
            if (!isMatch) {
                const updated = await UserRepository.incrementLoginAttempts(user._id);
                const attempts = (updated?.loginAttempts || 1);
                if (attempts >= MAX_LOGIN_ATTEMPTS) {
                    const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                    await User.findByIdAndUpdate(user._id, { lockUntil, updatedAt: new Date() });
                    logSecurityEvent('auth.login.locked', { userId: user._id, email: user.email, attempts });
                    emailService.sendAccountLockedEmail(user.email, user.fullName, lockUntil).catch(() => {});
                    throw new Error(`Account locked due to too many failed attempts. Try again in 15 minutes.`);
                }
                logSecurityEvent('auth.login.failed', { email: normalizedEmail, attempts });
                throw new Error(`Email or password is incorrect. ${MAX_LOGIN_ATTEMPTS - attempts} attempt(s) remaining.`);
            }

            await UserRepository.resetLoginAttempts(user._id);
            const updatedUser = await UserRepository.updateLastLoginAt(user._id);
            return updatedUser || user;
        }

        logSecurityEvent('auth.login.failed', { email: normalizedEmail });
        throw new Error('Email or password is incorrect.');
    }

    /**
     * Gửi mã xác nhận qua email. Không báo lộ email có tồn tại hay không (message chung chung cho user).
     * Trả về object để controller biết email có tồn tại hay không (chỉ dùng nội bộ).
     */
    async requestResetCode(email) {
        const normalizedEmail = validateEmail(email);
        if (!normalizedEmail) {
            return { emailExists: false, sent: false };
        }

        const user = await UserRepository.findByEmail(normalizedEmail);
        if (!user) {
            return { emailExists: false, sent: false };
        }

        if (user.isBlocked) {
            logSecurityEvent('auth.reset_code.blocked', { userId: user._id, email: user.email });
            throw new Error('Account is blocked.');
        }

        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);
        await UserRepository.setResetPasswordToken(user._id, resetToken, expiresAt);
        await emailService.sendResetCodeEmail(normalizedEmail, resetToken);

        return { emailExists: true, sent: true };
    }

    /**
     * Đặt lại mật khẩu bằng token bảo mật (dùng 1 lần).
     */
    async resetPassword(token, newPassword, confirmPassword, email) {
        if (!token) {
            throw new Error('Reset token is required.');
        }
        if (!newPassword || !confirmPassword) {
            throw new Error('New password and confirmation are required.');
        }
        if (newPassword !== confirmPassword) {
            throw new Error('Password confirmation does not match.');
        }

        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            throw new Error(strength.errors.join(' '));
        }

        const user = await UserRepository.findUserByResetToken(token);
        if (!user) {
            logSecurityEvent('auth.reset_token.invalid', { token: 'present', email: email || 'unknown' });
            throw new Error('Invalid or expired reset link. Please request a new one.');
        }

        UserService.checkAccountLock(user);

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await UserRepository.updatePassword(user._id, hashedPassword);
        await UserRepository.clearResetPassword(user._id);
        await UserRepository.resetLoginAttempts(user._id);
        logSecurityEvent('auth.password.reset', { userId: user._id, email: user.email });
    }

    // Export constants for external use (e.g. AuthController)
    static LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MS;
    static MAX_LOGIN_ATTEMPTS = MAX_LOGIN_ATTEMPTS;

    static checkAccountLock(user) {
        if (!user) return;
        if (user.lockUntil && user.lockUntil > new Date()) {
            const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / 60000);
            throw new Error(`Account is locked. Try again in ${remainingMinutes} minute(s).`);
        }
    }
}

module.exports = new UserService();
