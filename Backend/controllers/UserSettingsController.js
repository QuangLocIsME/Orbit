const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const UserRepository = require('../repositories/UserRepository');
const { errorResponse } = require('../utils/response');
const { logSecurityEvent } = require('../utils/securityLog');
const { hashToken, encryptSecret, decryptSecret } = require('../utils/cryptoUtils');
const { delKeys } = require('../services/cacheService');
const { broadcastAll } = require('../services/socketService');
const {
    buildUserAvatarPath,
    uploadUserAvatarBuffer,
    deleteUserAvatarFile,
} = require('../services/supabaseStorageService');
const { verifyTOTP } = require('../utils/totpUtils');

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function base32Encode(buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            output += alphabet[(value >>> bits) & 0x1f];
        }
    }
    if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 0x1f];
    }
    return output;
}

function generateOTPAuthURL(issuer, accountName, secret) {
    const params = new URLSearchParams({
        secret,
        issuer: issuer || 'ORBIT',
        digits: '6',
        period: '30',
    });
    return `otpauth://totp/${encodeURIComponent(issuer || 'ORBIT')}:${encodeURIComponent(accountName)}?${params}`;
}

function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    str = str.toUpperCase().replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const output = [];

    for (const char of str) {
        const v = alphabet.indexOf(char);
        if (v === -1) continue;
        value = (value << 5) | v;
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            output.push((value >>> bits) & 0xff);
        }
    }
    return Buffer.from(output);
}

function generateTOTPCode(secret, timeStep) {
    const key = base32Decode(secret);
    const counter = Math.floor(timeStep);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const h = hmac.digest();
    const offset = h[h.length - 1] & 0xf;
    const code = (
        ((h[offset] & 0x7f) << 24) |
        ((h[offset + 1] & 0xff) << 16) |
        ((h[offset + 2] & 0xff) << 8) |
        (h[offset + 3] & 0xff)
    ) % 1000000;
    return String(code).padStart(6, '0');
}

class UserSettingsController {
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const user = await UserRepository.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            return res.status(200).json({
                success: true,
                data: {
                    id: user._id,
                    publicId: user.publicId,
                    fullName: user.fullName,
                    email: user.email,
                    avatar: user.avatar || null,
                    provider: user.provider,
                    role: user.role,
                    isVerified: user.isVerified,
                    hasPassword: !!user.password,
                    twoFactorEnabled: !!user.twoFactorSecret,
                    twoFactorVerified: !!user.twoFactorVerified,
                    createdAt: user.createdAt,
                    lastLoginAt: user.lastLoginAt,
                    jobTitle: user.jobTitle || null,
                    company: user.company || null,
                    bio: user.bio || null,
                },
            });
        } catch (error) {
            console.error('[UserSettings] getProfile error:', error);
            return errorResponse(res, 500, 'Failed to get profile');
        }
    }

    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { fullName, jobTitle, company, bio } = req.body || {};

            if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
                return errorResponse(res, 400, 'Full name must be at least 2 characters');
            }
            if (fullName.trim().length > 200) {
                return errorResponse(res, 400, 'Full name must be at most 200 characters');
            }

            const user = await User.findByIdAndUpdate(
                userId,
                {
                    fullName: fullName.trim(),
                    ...(jobTitle !== undefined && { jobTitle: jobTitle ? String(jobTitle).trim() : null }),
                    ...(company !== undefined && { company: company ? String(company).trim() : null }),
                    ...(bio !== undefined && { bio: bio ? String(bio).trim().substring(0, 500) : null }),
                    updatedAt: new Date(),
                },
                { returnDocument: 'after', runValidators: true }
            );

            if (!user) return errorResponse(res, 404, 'User not found');

            await delKeys([`auth:me:${userId}`]);

            return res.status(200).json({
                success: true,
                message: 'Profile updated',
                data: {
                    id: user._id,
                    fullName: user.fullName,
                    avatar: user.avatar || null,
                    jobTitle: user.jobTitle || null,
                    company: user.company || null,
                    bio: user.bio || null,
                },
            });
        } catch (error) {
            console.error('[UserSettings] updateProfile error:', error);
            return errorResponse(res, 500, 'Failed to update profile');
        }
    }

    async uploadAvatar(req, res) {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return errorResponse(res, 400, 'No file uploaded');
            }

            const { mimetype, size, buffer } = req.file;

            if (!ALLOWED_AVATAR_TYPES.includes(mimetype)) {
                return errorResponse(res, 400, 'Invalid file type. Allowed: JPG, PNG, GIF, WEBP');
            }
            if (size > MAX_AVATAR_SIZE) {
                return errorResponse(res, 400, 'File too large. Max size is 5MB');
            }

            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (user.avatarStoragePath) {
                await deleteUserAvatarFile(user.avatarStoragePath);
            }

            const storagePath = buildUserAvatarPath({
                userId: user.publicId,
                fileName: req.file.originalname || 'avatar.jpg',
            });
            const { publicUrl } = await uploadUserAvatarBuffer(buffer, storagePath);

            await User.findByIdAndUpdate(userId, {
                avatar: publicUrl,
                avatarStoragePath: storagePath,
                updatedAt: new Date(),
            });

            await delKeys([`auth:me:${userId}`]);

            broadcastAll('user:avatar:updated', {
                userId: user.publicId,
                avatar: publicUrl,
            });

            return res.status(200).json({
                success: true,
                message: 'Avatar uploaded',
                data: { avatar: publicUrl },
            });
        } catch (error) {
            console.error('[UserSettings] uploadAvatar error:', error);
            return errorResponse(res, 500, 'Failed to upload avatar');
        }
    }

    async deleteAvatar(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (user.avatarStoragePath) {
                await deleteUserAvatarFile(user.avatarStoragePath);
            }

            await User.findByIdAndUpdate(userId, {
                avatar: null,
                avatarStoragePath: null,
                updatedAt: new Date(),
            });

            await delKeys([`auth:me:${userId}`]);
            broadcastAll('user:avatar:updated', {
                userId,
                avatar: '',
            });

            return res.status(200).json({
                success: true,
                message: 'Avatar deleted',
            });
        } catch (error) {
            console.error('[UserSettings] deleteAvatar error:', error);
            return errorResponse(res, 500, 'Failed to delete avatar');
        }
    }

    async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword, confirmPassword } = req.body || {};

            if (!currentPassword || !newPassword || !confirmPassword) {
                return errorResponse(res, 400, 'All password fields are required');
            }
            if (newPassword !== confirmPassword) {
                return errorResponse(res, 400, 'New password and confirmation do not match');
            }
            if (newPassword.length < 8) {
                return errorResponse(res, 400, 'Password must be at least 8 characters');
            }

            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (user.provider === 'google') {
                return errorResponse(res, 400, 'Google accounts cannot change password here. Use Google account settings.');
            }

            if (user.password) {
                const isMatch = await bcrypt.compare(currentPassword, user.password);
                if (!isMatch) {
                    logSecurityEvent('user.password.wrong_current', { userId, email: user.email });
                    return errorResponse(res, 400, 'Current password is incorrect');
                }
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await User.findByIdAndUpdate(userId, {
                password: hashedPassword,
                updatedAt: new Date(),
            });

            await UserRepository.revokeAllRefreshTokens(userId);
            await delKeys([`auth:me:${userId}`]);

            logSecurityEvent('user.password.changed', { userId, email: user.email });

            return res.status(200).json({
                success: true,
                message: 'Password updated successfully. All other sessions have been logged out.',
            });
        } catch (error) {
            console.error('[UserSettings] changePassword error:', error);
            return errorResponse(res, 500, 'Failed to change password');
        }
    }

    async setup2FA(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (user.twoFactorVerified) {
                return errorResponse(res, 400, '2FA is already enabled');
            }

            const secretBytes = crypto.randomBytes(20);
            const secret = base32Encode(secretBytes);
            const otpauthUrl = generateOTPAuthURL('ORBIT', user.email, secret);

            const encryptedPending = encryptSecret(secret);
            if (!encryptedPending) {
                return errorResponse(res, 500, 'Failed to setup 2FA');
            }

            await User.findByIdAndUpdate(userId, {
                twoFactorPendingSecret: encryptedPending,
                updatedAt: new Date(),
            });

            return res.status(200).json({
                success: true,
                data: {
                    secret,
                    otpauthUrl,
                    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
                },
            });
        } catch (error) {
            console.error('[UserSettings] setup2FA error:', error);
            return errorResponse(res, 500, 'Failed to setup 2FA');
        }
    }

    async verify2FA(req, res) {
        try {
            const userId = req.user.id;
            const { token } = req.body || {};

            if (!token || !/^\d{6}$/.test(token)) {
                return errorResponse(res, 400, 'A valid 6-digit code is required');
            }

            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (!user.twoFactorPendingSecret) {
                return errorResponse(res, 400, 'No pending 2FA setup found. Please start the setup process again.');
            }

            const pendingSecret = decryptSecret(user.twoFactorPendingSecret);
            if (!pendingSecret) {
                return errorResponse(res, 500, 'Failed to verify 2FA');
            }

            if (!verifyTOTP(pendingSecret, token)) {
                logSecurityEvent('user.2fa.verify_failed', { userId, email: user.email });
                return errorResponse(res, 400, 'Invalid verification code');
            }

            const encryptedSecret = encryptSecret(pendingSecret);
            if (!encryptedSecret) {
                return errorResponse(res, 500, 'Failed to save 2FA secret');
            }

            await User.findByIdAndUpdate(userId, {
                twoFactorSecret: encryptedSecret,
                twoFactorPendingSecret: null,
                twoFactorVerified: true,
                updatedAt: new Date(),
            });

            await delKeys([`auth:me:${userId}`]);

            logSecurityEvent('user.2fa.enabled', { userId, email: user.email });

            return res.status(200).json({
                success: true,
                message: 'Two-factor authentication has been enabled',
            });
        } catch (error) {
            console.error('[UserSettings] verify2FA error:', error);
            return errorResponse(res, 500, 'Failed to verify 2FA');
        }
    }

    async disable2FA(req, res) {
        try {
            const userId = req.user.id;
            const { token, password } = req.body || {};

            if (!token || !/^\d{6}$/.test(token)) {
                return errorResponse(res, 400, 'A valid 6-digit code is required');
            }
            if (!password) {
                return errorResponse(res, 400, 'Password is required to disable 2FA');
            }

            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (!user.twoFactorVerified || !user.twoFactorSecret) {
                return errorResponse(res, 400, '2FA is not currently enabled');
            }

            if (user.password) {
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    logSecurityEvent('user.2fa.disable_wrong_password', { userId, email: user.email });
                    return errorResponse(res, 400, 'Password is incorrect');
                }
            }

            const decryptedSecret = decryptSecret(user.twoFactorSecret);
            if (!decryptedSecret) {
                return errorResponse(res, 500, 'Failed to decrypt 2FA secret');
            }

            if (!verifyTOTP(decryptedSecret, token)) {
                logSecurityEvent('user.2fa.disable_wrong_token', { userId, email: user.email });
                return errorResponse(res, 400, 'Invalid verification code');
            }

            await User.findByIdAndUpdate(userId, {
                twoFactorSecret: null,
                twoFactorPendingSecret: null,
                twoFactorVerified: false,
                updatedAt: new Date(),
            });

            await delKeys([`auth:me:${userId}`]);

            logSecurityEvent('user.2fa.disabled', { userId, email: user.email });

            return res.status(200).json({
                success: true,
                message: 'Two-factor authentication has been disabled',
            });
        } catch (error) {
            console.error('[UserSettings] disable2FA error:', error);
            return errorResponse(res, 500, 'Failed to disable 2FA');
        }
    }

    async deleteAccount(req, res) {
        try {
            const userId = req.user.id;
            const { password, confirmText } = req.body || {};

            if (!confirmText || confirmText !== 'DELETE') {
                return errorResponse(res, 400, 'Please type DELETE to confirm account deletion');
            }

            const user = await User.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            if (user.provider === 'local' && user.password) {
                if (!password) {
                    return errorResponse(res, 400, 'Password is required to delete your account');
                }
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    logSecurityEvent('user.delete.wrong_password', { userId, email: user.email });
                    return errorResponse(res, 400, 'Password is incorrect');
                }
            }

            if (user.avatarStoragePath) {
                await deleteUserAvatarFile(user.avatarStoragePath);
            }

            await User.findByIdAndUpdate(userId, {
                email: `deleted_${user._id}_${user.email}`,
                fullName: 'Deleted User',
                avatar: null,
                avatarStoragePath: null,
                password: null,
                googleId: null,
                isActive: false,
                isBlocked: true,
                isDeleted: true,
                twoFactorSecret: null,
                twoFactorPendingSecret: null,
                twoFactorVerified: false,
                refreshTokens: [],
                updatedAt: new Date(),
            });

            await UserRepository.revokeAllRefreshTokens(userId);
            await delKeys([`auth:me:${userId}`]);

            logSecurityEvent('user.deleted', { userId, email: user.email });

            const isProduction = process.env.IS_PRODUCTION === 'true';
            res.clearCookie('accessToken', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
            res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite: 'lax' });

            return res.status(200).json({
                success: true,
                message: 'Account has been deleted',
            });
        } catch (error) {
            console.error('[UserSettings] deleteAccount error:', error);
            return errorResponse(res, 500, 'Failed to delete account');
        }
    }
}

module.exports = new UserSettingsController();
