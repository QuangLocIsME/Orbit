const express = require('express');
const ChangeRequestController = require('../controllers/ChangeRequestController');
const { authenticate } = require('../middlewares/authMiddleware');
const { crAttachmentUpload } = require('../middlewares/crAttachmentMiddleware');

const router = express.Router();

router.get('/projects/:projectSlug/change-requests', authenticate, (req, res) =>
    ChangeRequestController.listByProject(req, res));

router.post('/projects/:projectSlug/change-requests', authenticate, crAttachmentUpload.array('attachments', 20), (req, res) =>
    ChangeRequestController.create(req, res));

router.put('/change-requests', authenticate, (req, res) =>
    ChangeRequestController.update(req, res));

router.post('/change-requests/update-status', authenticate, (req, res) =>
    ChangeRequestController.updateStatus(req, res));

router.delete('/change-requests', authenticate, (req, res) =>
    ChangeRequestController.delete(req, res));

router.post('/change-requests/comments/list', authenticate, (req, res) =>
    ChangeRequestController.listComments(req, res));

router.post('/change-requests/comments/create', authenticate, (req, res) =>
    ChangeRequestController.createComment(req, res));

module.exports = router;
