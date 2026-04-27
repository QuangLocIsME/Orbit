const express = require('express');
const multer = require('multer');
const UserSettingsController = require('../controllers/UserSettingsController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/profile', authenticate, (req, res) => UserSettingsController.getProfile(req, res));
router.put('/profile', authenticate, (req, res) => UserSettingsController.updateProfile(req, res));
router.post('/avatar', authenticate, upload.single('avatar'), (req, res) => UserSettingsController.uploadAvatar(req, res));
router.post('/avatar/delete', authenticate, (req, res) => UserSettingsController.deleteAvatar(req, res));
router.post('/change-password', authenticate, (req, res) => UserSettingsController.changePassword(req, res));
router.post('/2fa/setup', authenticate, (req, res) => UserSettingsController.setup2FA(req, res));
router.post('/2fa/verify', authenticate, (req, res) => UserSettingsController.verify2FA(req, res));
router.post('/2fa/disable', authenticate, (req, res) => UserSettingsController.disable2FA(req, res));
router.post('/delete-account', authenticate, (req, res) => UserSettingsController.deleteAccount(req, res));

module.exports = router;
