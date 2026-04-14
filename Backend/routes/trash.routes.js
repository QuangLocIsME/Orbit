const express = require('express');
const ProjectController = require('../controllers/ProjectController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/list', authenticate, (req, res) => ProjectController.getTrashProjects(req, res));

module.exports = router;
