const express = require('express');
const multer = require('multer');
const ProjectController = require('../controllers/ProjectController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/me', authenticate, (req, res) => ProjectController.getMyProjects(req, res));
router.post('/create', authenticate, (req, res) => ProjectController.createProject(req, res));
router.post('/member-list', authenticate, (req, res) => ProjectController.getProjectMembers(req, res));
router.post('/update', authenticate, (req, res) => ProjectController.updateProject(req, res));
router.post('/move-folder', authenticate, (req, res) => ProjectController.moveProjectToFolder(req, res));
router.post('/remove-folder', authenticate, (req, res) => ProjectController.removeProjectFromFolder(req, res));
router.post('/delete', authenticate, (req, res) => ProjectController.deleteProject(req, res));
router.post('/members/update-role', authenticate, (req, res) => ProjectController.updateMemberRole(req, res));
router.post('/members/remove', authenticate, (req, res) => ProjectController.removeMember(req, res));
router.post('/workflow', authenticate, (req, res) => ProjectController.getWorkflow(req, res));
router.post('/workflow/update', authenticate, (req, res) => ProjectController.updateWorkflow(req, res));
router.post('/workflow/apply-template', authenticate, (req, res) => ProjectController.applyWorkflowTemplate(req, res));
router.post('/touch', authenticate, (req, res) => ProjectController.touchProject(req, res));
router.post('/favorite/toggle', authenticate, (req, res) => ProjectController.toggleFavorite(req, res));
router.get('/favorites', authenticate, (req, res) => ProjectController.getFavoriteProjects(req, res));
router.post('/trash', authenticate, (req, res) => ProjectController.trashProject(req, res));
router.post('/restore', authenticate, (req, res) => ProjectController.restoreProject(req, res));
router.post('/delete-permanent', authenticate, (req, res) => ProjectController.deletePermanentProject(req, res));
router.post('/upload-thumbnail', authenticate, upload.single('thumbnail'), (req, res) => ProjectController.uploadThumbnail(req, res));
router.post('/upload-avatar', authenticate, upload.single('avatar'), (req, res) => ProjectController.uploadAvatar(req, res));
router.post('/delete-avatar', authenticate, (req, res) => ProjectController.deleteAvatar(req, res));

module.exports = router;
