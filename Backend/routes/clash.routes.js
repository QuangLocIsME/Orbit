const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { requireProjectMember } = require('../middlewares/projectAccessMiddleware');
const ClashController = require('../controllers/clash.controller');

const router = express.Router();

const access = [authenticate, requireProjectMember('projectSlug')];

// Object position overrides (viewer / clashStore) — Navisworks clash IDs supported
router.get('/projects/:projectSlug/clashes/:clashId/positions', ...access, (req, res) =>
    ClashController.getPositions(req, res));
router.patch('/projects/:projectSlug/clashes/:clashId/positions', ...access, (req, res) =>
    ClashController.savePositions(req, res));
router.delete('/projects/:projectSlug/clashes/:clashId/positions', ...access, (req, res) =>
    ClashController.resetPositions(req, res));

module.exports = router;
