const UserService = require('../services/UserService');
const UserRepository = require('../repositories/UserRepository');
const emailService = require('../services/emailService');
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Register failed',
            });
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Login failed',
            });
        }
    }

    async refreshToken(req, res) {
        try {
            const tokenFromBody = req.body?.refreshToken;
            const tokenFromCookie = req.cookies?.refreshToken;
            const refreshToken = tokenFromBody || tokenFromCookie;

            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing refresh token',
                });
            }

            const payload = verifyToken(refreshToken);
            const user = await UserRepository.findUserByRefreshToken(refreshToken);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token not found',
                });
            }

            if (user.isBlocked || user.isActive === false) {
                await UserRepository.revokeAllRefreshTokens(user._id);
                return res.status(403).json({
                    success: false,
                    message: 'User account is blocked',
                });
            }

            await UserRepository.removeExpiredRefreshTokens(user._id);

            const activeTokenUser = await UserRepository.getActiveRefreshToken(
                user._id,
                refreshToken
            );
            if (!activeTokenUser) {
                await UserRepository.revokeAllRefreshTokens(user._id);
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token revoked',
                });
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
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
            });
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
                }
            }

            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            return res.status(200).json({
                success: true,
                message: 'Logout success',
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Logout failed',
            });
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
                return res.status(403).json({ success: false, message: error.message });
            }
            return res.status(400).json({
                success: false,
                message: error.message || 'Request failed',
            });
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Invalid or expired code',
            });
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Reset failed',
            });
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Reset failed',
            });
        }
    }

    /**
     * Google OAuth callback: generate JWT, send welcome email if new user, redirect to frontend with token + user.
     */
    async googleCallback(req, res) {
        const result = req.authResult;
        if (!result?.user) {
            const message = result?.error?.message || 'Google authentication failed';
            return res.redirect(this.getFrontendAuthRedirectUrl(false, null, null, message));
        }

        const { user, isNew } = result;
        if (user.isBlocked || user.isActive === false) {
            return res.redirect(this.getFrontendAuthRedirectUrl(false, null, null, 'Account is blocked'));
        }

        const payload = { id: user._id, email: user.email, role: user.role };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        try {
            if (user.refreshTokens !== undefined) {
                await UserRepository.setSingleRefreshToken(user._id, buildRefreshTokenRecord(refreshToken));
            }
        } catch (e) {
            // ignore if no refreshTokens field
        }

        setAuthCookies(res, accessToken, refreshToken);

        if (isNew) {
            emailService.sendWelcomeEmail(user.email, user.fullName).catch((err) =>
                console.error('[Auth] Welcome email failed:', err.message)
            );
        }

        const frontendUrl = this.getFrontendAuthRedirectUrl(true, accessToken, {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            provider: user.provider,
        });
        return res.redirect(frontendUrl);
    }

    getFrontendAuthRedirectUrl(success, token, user, errorMessage) {
        const base = (process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321').replace(/\/$/, '');
        const params = new URLSearchParams();
        if (success && token) {
            params.set('token', token);
            if (user) params.set('user', JSON.stringify(user));
        }
        if (errorMessage) params.set('error', errorMessage);
        const q = params.toString();
        return `${base}/auth/callback${q ? `?${q}` : ''}`;
    }
}

module.exports = new AuthController();
