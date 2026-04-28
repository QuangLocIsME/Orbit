const express = require('express');
const UploadApprovalController = require('../controllers/UploadApprovalController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/approvals/list', authenticate, (req, res) =>
    UploadApprovalController.listPending(req, res)
);

router.post('/approvals/pending/count', authenticate, (req, res) =>
    UploadApprovalController.getPendingCount(req, res)
);

router.post('/approvals/approve', authenticate, (req, res) =>
    UploadApprovalController.approve(req, res)
);

router.post('/approvals/reject', authenticate, (req, res) =>
    UploadApprovalController.reject(req, res)
);

router.post('/approvals/comments/list', authenticate, (req, res) =>
    UploadApprovalController.listComments(req, res)
);

router.post('/approvals/comments/add', authenticate, (req, res) =>
    UploadApprovalController.addComment(req, res)
);

router.post('/approvals/comments/delete', authenticate, (req, res) =>
    UploadApprovalController.deleteComment(req, res)
);

module.exports = router;
