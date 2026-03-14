const express = require('express');
const EmailController = require('../controllers/EmailController');

const router = express.Router();

router.post('/send-email', (req, res) => EmailController.sendEmail(req, res));

module.exports = router;
