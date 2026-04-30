const express = require('express');
const router = express.Router();
const JoinRequestController = require('../controllers/JoinRequestController');
const { authenticate } = require('../middlewares/authMiddleware');

router.post('/request', authenticate, (req, res) => JoinRequestController.createRequest(req, res));
router.get('/list', authenticate, (req, res) => JoinRequestController.listRequests(req, res));
router.post('/approve', authenticate, (req, res) => JoinRequestController.approveRequest(req, res));
router.post('/reject', authenticate, (req, res) => JoinRequestController.rejectRequest(req, res));
router.post('/cancel', authenticate, (req, res) => JoinRequestController.cancelRequest(req, res));

module.exports = router;
