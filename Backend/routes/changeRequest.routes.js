const express = require('express');
const ChangeRequestController = require('../controllers/ChangeRequestController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/projects/:projectSlug/change-requests', authenticate, (req, res) =>
    ChangeRequestController.listByProject(req, res));

router.post('/projects/:projectSlug/change-requests', authenticate, (req, res) =>
    ChangeRequestController.create(req, res));

router.post('/change-requests/update-status', authenticate, (req, res) =>
    ChangeRequestController.updateStatus(req, res));

router.delete('/change-requests', authenticate, (req, res) =>
    ChangeRequestController.delete(req, res));

module.exports = router;
