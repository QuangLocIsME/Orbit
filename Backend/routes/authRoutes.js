const express = require('express');
const passport = require('passport');
const AuthController = require('../controllers/AuthController');

const router = express.Router();

router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({ success: false, message: 'Google login is not configured.' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, result) => {
        if (err) {
            const base = (process.env.FRONTEND_URI || process.env.FRONTED_URI || 'http://localhost:4321').replace(/\/$/, '');
            return res.redirect(`${base}/auth/callback?success=0&error=${encodeURIComponent(err.message)}`);
        }
        req.authResult = result;
        next();
    })(req, res, next);
}, (req, res) => AuthController.googleCallback(req, res));

router.post('/register', (req, res) => AuthController.register(req, res));
router.post('/login', (req, res) => AuthController.login(req, res));
router.post('/refresh-token', (req, res) => AuthController.refreshToken(req, res));
router.post('/logout', (req, res) => AuthController.logout(req, res));

// Forgot password: gửi mã qua email → đặt lại mật khẩu bằng mã (hoặc bằng token)
router.post('/forgot-password', (req, res) => AuthController.forgotPassword(req, res));
router.post('/verify-reset-code', (req, res) => AuthController.verifyResetCode(req, res));
router.post('/reset-password', (req, res) => AuthController.resetPassword(req, res));
// Đặt lại mật khẩu bằng mã từ email (1 request: email + code + newPassword + confirmPassword)
router.post('/reset-password-with-code', (req, res) => AuthController.resetPasswordWithCode(req, res));

module.exports = router;
