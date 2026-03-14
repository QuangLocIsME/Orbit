const express = require('express');
const ProjectController = require('../controllers/ProjectController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/me', authenticate, (req, res) => ProjectController.getMyProjects(req, res));
router.post('/create', authenticate, (req, res) => ProjectController.createProject(req, res));
router.post('/member-list', authenticate, (req, res) => ProjectController.getProjectMembers(req, res));

module.exports = router;
