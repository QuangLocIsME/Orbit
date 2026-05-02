const express = require('express');
const ReportController = require('../controllers/ReportController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/projects/:projectId/reports — fetch report data (JSON preview)
router.get('/:projectId/reports', authenticate, (req, res) => ReportController.getReport(req, res));

// POST /api/projects/:projectId/reports/export — export as PDF / CSV / XLSX
router.post('/:projectId/reports/export', authenticate, (req, res) => ReportController.exportReport(req, res));

module.exports = router;
