const express = require('express');
const ProjectController = require('../controllers/ProjectController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/me', authenticate, (req, res) => ProjectController.getMyProjects(req, res));
router.post('/create', authenticate, (req, res) => ProjectController.createProject(req, res));
router.post('/member-list', authenticate, (req, res) => ProjectController.getProjectMembers(req, res));
router.post('/update', authenticate, (req, res) => ProjectController.updateProject(req, res));
router.post('/move-folder', authenticate, (req, res) => ProjectController.moveProjectToFolder(req, res));
router.post('/remove-folder', authenticate, (req, res) => ProjectController.removeProjectFromFolder(req, res));
router.post('/delete', authenticate, (req, res) => ProjectController.deleteProject(req, res));
router.post('/members/update-role', authenticate, (req, res) => ProjectController.updateMemberRole(req, res));
router.post('/members/remove', authenticate, (req, res) => ProjectController.removeMember(req, res));

module.exports = router;
