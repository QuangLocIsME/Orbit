const express = require('express');
const ActivityController = require('../controllers/ActivityController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/projects/:projectSlug/activities', authenticate, (req, res) =>
    ActivityController.listByProject(req, res));
router.get('/projects/:projectSlug/packages/:packageId/activities', authenticate, (req, res) =>
    ActivityController.listByPackage(req, res));

module.exports = router;
