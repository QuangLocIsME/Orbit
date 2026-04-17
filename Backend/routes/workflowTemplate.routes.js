const express = require('express');
const router = express.Router();
const controller = require('../controllers/WorkflowTemplateController');
const { authenticate } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authenticate);

// GET /api/workflow-templates - Get all public templates (library)
router.get('/', controller.getAll);

// GET /api/workflow-templates/my - Get user's own templates
router.get('/my', controller.getMyTemplates);

// GET /api/workflow-templates/downloaded - Get templates that user has downloaded (copied from others)
router.get('/downloaded', controller.getDownloadedTemplates);

// GET /api/workflow-templates/tags - Get all available tags
router.get('/tags', controller.getTags);

// GET /api/workflow-templates/categories - Get all categories
router.get('/categories', controller.getCategories);

// GET /api/workflow-templates/:publicId - Get single template
router.get('/:publicId', controller.getById);

// POST /api/workflow-templates - Create new template
router.post('/', controller.create);

// POST /api/workflow-templates/copy/:publicId - Copy template to user's templates
router.post('/copy/:publicId', controller.copyTemplate);

// PUT /api/workflow-templates/:publicId - Update template
router.put('/:publicId', controller.update);

// DELETE /api/workflow-templates/:publicId - Delete template
router.delete('/:publicId', controller.delete);

// POST /api/workflow-templates/:publicId/use - Use template (increment downloads/rating)
router.post('/:publicId/use', controller.useTemplate);

module.exports = router;
