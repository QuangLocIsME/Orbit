const express = require('express');
const InviteController = require('../controllers/InviteController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authenticate, (req, res) => InviteController.createInvite(req, res));
router.post('/accept', authenticate, (req, res) => InviteController.acceptInvite(req, res));
router.post('/decline', authenticate, (req, res) => InviteController.declineInvite(req, res));
router.get('/:inviteId/status', authenticate, (req, res) => InviteController.getInviteStatus(req, res));
router.post('/revoke', authenticate, (req, res) => InviteController.revokeInvite(req, res));
router.get('/invites-list', authenticate, (req, res) => InviteController.listInvites(req, res));
router.post('/invites-list', authenticate, (req, res) => InviteController.listInvites(req, res));

module.exports = router;
