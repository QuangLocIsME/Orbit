const express = require('express');
const PackageController = require('../controllers/PackageController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/create', authenticate, (req, res) =>
    PackageController.createPackage(req, res)
);

router.post('/list', authenticate, (req, res) =>
    PackageController.listPackages(req, res)
);

router.post('/archive', authenticate, (req, res) =>
    PackageController.archivePackage(req, res)
);

router.post('/delete', authenticate, (req, res) =>
    PackageController.deletePackage(req, res)
);

module.exports = router;