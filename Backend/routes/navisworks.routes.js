const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middlewares/authMiddleware');
const { requireProjectMember } = require('../middlewares/projectAccessMiddleware');
const NavisworksClashController = require('../controllers/navisworksClash.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const access = [authenticate, requireProjectMember('projectSlug')];

router.get('/projects/:projectSlug/navisworks/workspace', ...access, (req, res) =>
    NavisworksClashController.getWorkspace(req, res));
router.get('/projects/:projectSlug/navisworks/clashes', ...access, (req, res) =>
    NavisworksClashController.listAllClashes(req, res));
router.post(
    '/projects/:projectSlug/navisworks/models/import',
    ...access,
    upload.array('models'),
    (req, res) => NavisworksClashController.importModels(req, res)
);
router.get('/projects/:projectSlug/navisworks/documents', ...access, (req, res) =>
    NavisworksClashController.listIfcDocuments(req, res));
router.post('/projects/:projectSlug/navisworks/models/import-from-documents', ...access, (req, res) =>
    NavisworksClashController.importFromDocuments(req, res));
router.get(
    '/projects/:projectSlug/navisworks/models/:modelId/xkt',
    ...access,
    (req, res) => NavisworksClashController.getModelXkt(req, res)
);
router.get('/projects/:projectSlug/navisworks/export/model', ...access, (req, res) =>
    NavisworksClashController.exportFederatedModel(req, res));

router.post('/projects/:projectSlug/navisworks/selection-sets', ...access, (req, res) =>
    NavisworksClashController.saveSelectionSet(req, res));
router.delete('/projects/:projectSlug/navisworks/selection-sets/:selectionSetId', ...access, (req, res) =>
    NavisworksClashController.deleteSelectionSet(req, res));

router.post('/projects/:projectSlug/navisworks/clash-tests', ...access, (req, res) =>
    NavisworksClashController.saveClashTest(req, res));
router.delete('/projects/:projectSlug/navisworks/clash-tests/:testId', ...access, (req, res) =>
    NavisworksClashController.deleteClashTest(req, res));
router.post('/projects/:projectSlug/navisworks/clash-tests/:testId/run', ...access, (req, res) =>
    NavisworksClashController.runClashTest(req, res));
router.get('/projects/:projectSlug/navisworks/clash-tests/:testId/results', ...access, (req, res) =>
    NavisworksClashController.getClashRun(req, res));
router.get('/projects/:projectSlug/navisworks/clash-tests/:testId/export', ...access, (req, res) =>
    NavisworksClashController.exportReport(req, res));
router.get('/projects/:projectSlug/navisworks/clash-tests/:testId/export/bcf', ...access, (req, res) =>
    NavisworksClashController.exportBCF(req, res));

router.patch('/projects/:projectSlug/navisworks/clashes/:clashId', ...access, (req, res) =>
    NavisworksClashController.updateClashStatus(req, res));
router.post('/projects/:projectSlug/navisworks/clashes/actions', ...access, (req, res) =>
    NavisworksClashController.applyObjectActions(req, res));

module.exports = router;
