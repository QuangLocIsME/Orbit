const express = require('express');
const ShareLinkController = require('../controllers/ShareLinkController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/create', authenticate, (req, res) => ShareLinkController.createShareLink(req, res));
router.get('/get', authenticate, (req, res) => ShareLinkController.getShareLink(req, res));
router.post('/update', authenticate, (req, res) => ShareLinkController.updateShareLink(req, res));
router.post('/delete', authenticate, (req, res) => ShareLinkController.deleteShareLink(req, res));

module.exports = router;
