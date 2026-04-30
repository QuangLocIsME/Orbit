const express = require('express');
const ChangeRequestController = require('../controllers/ChangeRequestController');
const CRVersionController = require('../controllers/CRVersionController');
const { authenticate } = require('../middlewares/authMiddleware');
const { crAttachmentUpload } = require('../middlewares/crAttachmentMiddleware');

const router = express.Router();

// ── CR CRUD ──────────────────────────────────────────────────────────────────────
router.get('/projects/:projectSlug/change-requests', authenticate, (req, res) =>
    ChangeRequestController.listByProject(req, res));

router.get('/projects-by-id/:projectId/change-requests', authenticate, (req, res) =>
    ChangeRequestController.listByProject(req, res));

router.post('/projects/:projectSlug/change-requests', authenticate, crAttachmentUpload.array('attachments', 20), (req, res) =>
    ChangeRequestController.create(req, res));

router.post('/change-requests/detail', authenticate, (req, res) =>
    ChangeRequestController.getDetail(req, res));

router.put('/change-requests', authenticate, (req, res) =>
    ChangeRequestController.update(req, res));

router.post('/change-requests/update-status', authenticate, (req, res) =>
    ChangeRequestController.updateStatus(req, res));

router.delete('/change-requests', authenticate, (req, res) =>
    ChangeRequestController.delete(req, res));

// ── CR Comments ─────────────────────────────────────────────────────────────────
router.post('/change-requests/comments/list', authenticate, (req, res) =>
    ChangeRequestController.listComments(req, res));

router.post('/change-requests/comments/create', authenticate, (req, res) =>
    ChangeRequestController.createComment(req, res));

router.put('/change-requests/comments', authenticate, (req, res) =>
    ChangeRequestController.updateComment(req, res));

router.delete('/change-requests/comments', authenticate, (req, res) =>
    ChangeRequestController.deleteComment(req, res));

// ── CR Task Linking ─────────────────────────────────────────────────────────────
router.post('/change-requests/create-task', authenticate, (req, res) =>
    ChangeRequestController.createTaskFromCR(req, res));

router.post('/change-requests/link-task', authenticate, (req, res) =>
    ChangeRequestController.linkTaskToCR(req, res));

router.post('/change-requests/unlink-task', authenticate, (req, res) =>
    ChangeRequestController.unlinkTaskFromCR(req, res));

// ── CR Versions ────────────────────────────────────────────────────────────────
router.get('/change-requests/:crId/versions', authenticate, (req, res) =>
    CRVersionController.listByCR(req, res));

router.get('/change-requests/versions/by-project/:projectId', authenticate, (req, res) =>
    CRVersionController.listByProject(req, res));

router.post('/change-requests/:crId/versions', authenticate, crAttachmentUpload.array('resultFiles', 10), (req, res) =>
    CRVersionController.create(req, res));

router.get('/change-requests/:crId/versions/:versionId', authenticate, (req, res) =>
    CRVersionController.getVersion(req, res));

router.post('/change-requests/:crId/versions/:versionId/approve', authenticate, (req, res) =>
    CRVersionController.approve(req, res));

router.post('/change-requests/:crId/versions/:versionId/reject', authenticate, (req, res) =>
    CRVersionController.reject(req, res));

module.exports = router;
