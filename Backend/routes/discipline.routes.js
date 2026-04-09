const express = require('express');
const router = express.Router();
const DisciplineController = require('../controllers/DisciplineController');
const { authenticate } = require('../middlewares/authMiddleware');

router.use(authenticate);

router.get('/projects/:projectSlug/disciplines', DisciplineController.listByProject);
router.post('/projects/:projectSlug/disciplines', DisciplineController.create);
router.put('/projects/:projectSlug/disciplines/:disciplineId', DisciplineController.update);
router.delete('/projects/:projectSlug/disciplines/:disciplineId', DisciplineController.delete);

module.exports = router;
