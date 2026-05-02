const express = require('express');
const FolderController = require('../controllers/FolderController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/me', authenticate, (req, res) => FolderController.getMyFolders(req, res));
router.post('/create', authenticate, (req, res) => FolderController.createFolder(req, res));
router.post('/update', authenticate, (req, res) => FolderController.updateFolder(req, res));
router.post('/delete', authenticate, (req, res) => FolderController.deleteFolder(req, res));
router.delete('/:id', authenticate, (req, res) => FolderController.deleteFolder(req, res));

module.exports = router;
