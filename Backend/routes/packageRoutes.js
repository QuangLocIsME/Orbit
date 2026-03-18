const express = require('express');
const PackageController = require('../controllers/PackageController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * POST /api/projects/packages/create
 * POST /api/projects/packages/list
 * (prefix được gắn trong app.js)
 */
router.post('/create', authenticate, (req, res) => PackageController.createPackage(req, res));
router.post('/list', authenticate, (req, res) => PackageController.getPackagesByProject(req, res));
router.post('/archive', authenticate, (req, res) => PackageController.archivePackage(req, res));
router.post('/reactivate', authenticate, (req, res) => PackageController.reactivatePackage(req, res));
router.post('/set-active', authenticate, (req, res) => PackageController.setPackageActive(req, res));
router.post('/delete', authenticate, (req, res) => PackageController.deletePackage(req, res));

module.exports = router;
