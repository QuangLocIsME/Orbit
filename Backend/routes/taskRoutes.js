const express = require('express');
const TaskController = require('../controllers/TaskController');
const { authenticate } = require('../middlewares/authMiddleware');
const { taskAttachmentUpload } = require('../middlewares/taskAttachmentMiddleware');

const router = express.Router();

router.post('/create', authenticate, (req, res) => TaskController.createTask(req, res));
router.post('/list', authenticate, (req, res) => TaskController.listTasks(req, res));
router.post('/my', authenticate, (req, res) => TaskController.listMyTasks(req, res));
router.post('/detail', authenticate, (req, res) => TaskController.detailTask(req, res));
router.post('/change-status', authenticate, (req, res) => TaskController.changeStatus(req, res));
router.post('/request-review', authenticate, (req, res) => TaskController.requestReview(req, res));
router.post('/comments/list', authenticate, (req, res) => TaskController.listComments(req, res));
router.post('/comments/create', authenticate, (req, res) => TaskController.createComment(req, res));
router.put('/comments', authenticate, (req, res) => TaskController.updateComment(req, res));
router.delete('/comments', authenticate, (req, res) => TaskController.deleteComment(req, res));
router.put('/', authenticate, (req, res) => TaskController.updateTask(req, res));
router.delete('/', authenticate, (req, res) => TaskController.deleteTask(req, res));
router.post('/upload-attachments', authenticate, taskAttachmentUpload.array('attachments', 20), (req, res) => TaskController.uploadAttachments(req, res));
router.post('/delete-attachment', authenticate, (req, res) => TaskController.deleteAttachment(req, res));

module.exports = router;
