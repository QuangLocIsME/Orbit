const UserService = require('../services/UserService');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');

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
            const isProduction = process.env.IS_PRODUCTION === 'true';

            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                maxAge: 15 * 60 * 1000,
            });

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            return res.status(200).json({
                success: true,
                message: 'Login success',
                data: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
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
            const newAccessToken = signAccessToken({
                id: payload.id,
                email: payload.email,
                role: payload.role,
            });
            const isProduction = process.env.IS_PRODUCTION === 'true';

            res.cookie('accessToken', newAccessToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                maxAge: 15 * 60 * 1000,
            });

            return res.status(200).json({
                success: true,
                message: 'Refresh token success',
                data: {
                    accessToken: newAccessToken,
                },
            });
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
            });
        }
    }
}

module.exports = new AuthController();
