const express = require('express');
const AuthController = require('../controllers/AuthController');

const router = express.Router();

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
