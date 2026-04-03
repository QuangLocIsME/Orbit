const UserService = require('../services/UserService');
const UserRepository = require('../repositories/UserRepository');
const emailService = require('../services/emailService');
const { logSecurityEvent } = require('../utils/securityLog');
const { errorResponse } = require('../utils/response');
const { getJson, setJson, delKeys } = require('../services/cacheService');
const {
    signAccessToken,
    signRefreshToken,
    verifyToken,
    ACCESS_TOKEN_EXPIRES_MS,
    REFRESH_TOKEN_EXPIRES_MS,
} = require('../utils/jwt');

const buildRefreshTokenRecord = (token) => ({
    token,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    revokedAt: null,
    replacedByToken: null,
});

const setAuthCookies = (res, accessToken, refreshToken) => {
    const isProduction = process.env.IS_PRODUCTION === 'true';

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: ACCESS_TOKEN_EXPIRES_MS,
    });

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_EXPIRES_MS,
    });
};

class AuthController {
    async register(req, res) {
        try {
            const user = await UserService.createUser(req.body);

            return res.status(201).json({
                success: true,
                message: 'Register success',
                data: {
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                },
            });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Register failed');
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body || {};
            const user = await UserService.loginUser(email, password);

            const payload = { id: user._id, email: user.email, role: user.role };
            const accessToken = signAccessToken(payload);
            const refreshToken = signRefreshToken(payload);

            await UserRepository.setSingleRefreshToken(
                user._id,
                buildRefreshTokenRecord(refreshToken)
            );

            setAuthCookies(res, accessToken, refreshToken);

            return res.status(200).json({
                success: true,
                message: 'Login success',
                data: {
                    fullName: user.fullName,
                    email: user.email,
                },
            });
        } catch (error) {
            return errorResponse(res, 400, 'Login failed');
        }
    }

    async refreshToken(req, res) {
        try {
            const tokenFromBody = req.body?.refreshToken;
            const tokenFromCookie = req.cookies?.refreshToken;
            const refreshToken = tokenFromBody || tokenFromCookie;

            if (!refreshToken) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const payload = verifyToken(refreshToken);
            if (!payload?.id) {
                logSecurityEvent('auth.refresh.invalid_payload', { token: 'present' });
                return errorResponse(res, 401, 'Unauthorized');
            }
            const user = await UserRepository.findUserByRefreshToken(refreshToken);
            if (!user) {
                logSecurityEvent('auth.refresh.invalid', { token: 'present' });
                return errorResponse(res, 401, 'Unauthorized');
            }

            if (user.isBlocked) {
                await UserRepository.revokeAllRefreshTokens(user._id);
                logSecurityEvent('auth.refresh.blocked', { userId: user._id, email: user.email });
                return errorResponse(res, 403, 'Unauthorized');
            }

            await UserRepository.removeExpiredRefreshTokens(user._id);

            const activeTokenUser = await UserRepository.getActiveRefreshToken(
                user._id,
                refreshToken
            );
            if (!activeTokenUser) {
                await UserRepository.revokeAllRefreshTokens(user._id);
                logSecurityEvent('auth.refresh.revoked', { userId: user._id, email: user.email });
                return errorResponse(res, 401, 'Unauthorized');
            }

            const newAccessToken = signAccessToken({
                id: payload.id,
                email: payload.email,
                role: payload.role,
            });
            const newRefreshToken = signRefreshToken({
                id: payload.id,
                email: payload.email,
                role: payload.role,
            });

            await UserRepository.revokeRefreshToken(user._id, refreshToken, newRefreshToken);
            await UserRepository.addRefreshToken(
                user._id,
                buildRefreshTokenRecord(newRefreshToken)
            );

            setAuthCookies(res, newAccessToken, newRefreshToken);

            return res.status(200).json({
                success: true,
                message: 'Refresh token success',
            });
        } catch (error) {
            logSecurityEvent('auth.refresh.failed', { reason: error?.message || 'unknown' });
            return errorResponse(res, 401, 'Unauthorized');
        }
    }

    async logout(req, res) {
        try {
            const tokenFromBody = req.body?.refreshToken;
            const tokenFromCookie = req.cookies?.refreshToken;
            const refreshToken = tokenFromBody || tokenFromCookie;

            if (refreshToken) {
                const user = await UserRepository.findUserByRefreshToken(refreshToken);
                if (user) {
                    await UserRepository.revokeRefreshToken(user._id, refreshToken);
                    logSecurityEvent('auth.logout', { userId: user._id, email: user.email });
                    await delKeys([`auth:me:${user._id}`]);
                }
            }

            const isProduction = process.env.IS_PRODUCTION === 'true';

            res.clearCookie('accessToken', {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
            });
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
            });

            return res.status(200).json({
                success: true,
                message: 'Logout success',
            });
        } catch (error) {
            return errorResponse(res, 500, 'Logout failed');
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body || {};
            await UserService.requestResetCode(email);
            return res.status(200).json({
                success: true,
                message: 'If that email exists, a verification code has been sent.',
            });
        } catch (error) {
            if (error.message === 'Account is blocked.') {
                return errorResponse(res, 403, 'Unauthorized');
            }
            return errorResponse(res, 400, 'Request failed');
        }
    }

    async verifyResetCode(req, res) {
        try {
            const { email, code } = req.body || {};
            const result = await UserService.verifyCodeAndCreateResetToken(email, code);
            return res.status(200).json({
                success: true,
                message: 'Code verified. Use the link to reset your password.',
                data: {
                    resetToken: result.resetToken,
                    resetPasswordUrl: result.resetPasswordUrl,
                },
            });
        } catch (error) {
            return errorResponse(res, 400, 'Invalid or expired code');
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, newPassword, confirmPassword } = req.body || {};
            await UserService.resetPassword(token, newPassword, confirmPassword);
            return res.status(200).json({
                success: true,
                message: 'Password has been reset. You can log in with your new password.',
            });
        } catch (error) {
            return errorResponse(res, 400, 'Reset failed');
        }
    }

    /**
     * Đặt lại mật khẩu bằng mã từ email (1 request: email + code + newPassword + confirmPassword).
     * Dùng sau khi nhận mail reset: nhập mã + mật khẩu mới + xác nhận mật khẩu.
     */
    async resetPasswordWithCode(req, res) {
        try {
            const { email, code, newPassword, confirmPassword } = req.body || {};
            await UserService.resetPasswordWithCode(email, code, newPassword, confirmPassword);
            return res.status(200).json({
                success: true,
                message: 'Password has been reset. You can log in with your new password.',
            });
        } catch (error) {
            return errorResponse(res, 400, 'Reset failed');
        }
    }

    /**
     * Google OAuth callback: generate JWT, send welcome email if new user, redirect to frontend with token + user.
     */
    async googleCallback(req, res) {
        const result = req.authResult;
        if (!result?.user) {
            const message = result?.error?.message || 'Google authentication failed';
            logSecurityEvent('auth.google.failed', { reason: message });
            return res.redirect(this.getFrontendAuthRedirectUrl(false, null, null, message));
        }

        const { user, isNew } = result;
        if (user.isBlocked) {
            logSecurityEvent('auth.google.blocked', { userId: user._id, email: user.email });
            return res.redirect(this.getFrontendAuthRedirectUrl(false, null, null, 'Account is blocked'));
        }

        const payload = { id: user._id, email: user.email, role: user.role };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        await UserRepository.setSingleRefreshToken(
            user._id,
            buildRefreshTokenRecord(refreshToken)
        );

        setAuthCookies(res, accessToken, refreshToken);

        if (isNew) {
            emailService.sendWelcomeEmail(user.email, user.fullName).catch((err) =>
                console.error('[Auth] Welcome email failed')
            );
        }

        const frontendUrl = this.getFrontendAuthRedirectUrl(true, accessToken, {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            avatar: user.avatar || user.image,
            provider: user.provider,
        });
        return res.redirect(frontendUrl);
    }

    async getMe(req, res) {
        try {
            const userId = req.user.id;
            const cacheKey = `auth:me:${userId}`;

            const cached = await getJson(cacheKey);
            if (cached) {
                return res.status(200).json({ success: true, data: cached, cached: true });
            }

            const user = await UserRepository.findById(userId);
            if (!user) return errorResponse(res, 404, 'User not found');

            const data = {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                avatar: user.avatar || null,
                createdAt: user.createdAt,
            };

            await setJson(cacheKey, data, 120);

            return res.status(200).json({ success: true, data });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to get user info');
        }
    }

    getFrontendAuthRedirectUrl(success, token, user, errorMessage) {
        const base = (process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321').replace(/\/$/, '');
        const params = new URLSearchParams();
        params.set('success', success ? '1' : '0');
        if (errorMessage) params.set('error', errorMessage);
        const q = params.toString();
        return `${base}/auth/callback${q ? `?${q}` : ''}`;
    }
}

module.exports = new AuthController();
