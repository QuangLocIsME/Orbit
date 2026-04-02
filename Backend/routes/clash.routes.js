const express = require('express');
const ClashController = require('../controllers/clash.controller');

const router = express.Router();

// ---------------------------------------------------------------------------
// Clash detection
// ---------------------------------------------------------------------------
router.post('/projects/:projectSlug/clash-detect', (req, res) => ClashController.detect(req, res));
router.get('/projects/:projectSlug/clashes', (req, res) => ClashController.list(req, res));

// BCF export — phải đứng trước /:clashId để tránh xung đột route
router.get('/projects/:projectSlug/clashes/export/bcf', (req, res) => ClashController.exportBCF(req, res));

// Per-clash resolution
router.get('/projects/:projectSlug/clashes/:clashId', (req, res) => ClashController.resolve(req, res));
router.patch('/projects/:projectSlug/clashes/:clashId', (req, res) => ClashController.resolve(req, res));

// Assign shorthand
router.patch('/projects/:projectSlug/clashes/:clashId/assign', (req, res) => ClashController.assign(req, res));

// Object position overrides
router.get('/projects/:projectSlug/clashes/:clashId/positions', (req, res) => ClashController.getPositions(req, res));
router.patch('/projects/:projectSlug/clashes/:clashId/positions', (req, res) => ClashController.savePositions(req, res));
router.delete('/projects/:projectSlug/clashes/:clashId/positions', (req, res) => ClashController.resetPositions(req, res));

// Project objects registry
router.get('/projects/:projectSlug/objects', (req, res) => ClashController.listObjects(req, res));
router.put('/projects/:projectSlug/objects', (req, res) => ClashController.saveProjectObjects(req, res));

// ---------------------------------------------------------------------------
// Legacy routes (backward compat)
// ---------------------------------------------------------------------------
router.post('/clash-detect', (req, res) => ClashController.detect(req, res));
router.get('/clashes', (req, res) => ClashController.list(req, res));

module.exports = router;
