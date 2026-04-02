const express = require('express');
const ClashController = require('../controllers/clash.controller');

const router = express.Router();

router.post('/clash-detect', (req, res) => ClashController.detect(req, res));
router.get('/clashes', (req, res) => ClashController.list(req, res));

module.exports = router;
