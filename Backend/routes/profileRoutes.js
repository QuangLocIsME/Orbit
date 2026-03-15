const express = require('express');
const ProfileController = require('../controllers/ProfileController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/me', authenticate, (req, res) => ProfileController.getCurrentUser(req, res));
router.get('/user/:publicId', authenticate, (req, res) => ProfileController.getUserById(req, res));

module.exports = router;
