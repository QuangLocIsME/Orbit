const express = require('express');
const ShareLinkController = require('../controllers/ShareLinkController');

const router = express.Router();

router.get('/resolve/:token', (req, res) => ShareLinkController.resolveShareLink(req, res));

module.exports = router;
