const express = require('express');
const TeamController = require('../controllers/TeamController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/list',           authenticate, (req, res) => TeamController.getTeams(req, res));
router.post('/create',         authenticate, (req, res) => TeamController.createTeam(req, res));
router.post('/delete',         authenticate, (req, res) => TeamController.deleteTeam(req, res));
router.post('/members/add',    authenticate, (req, res) => TeamController.addMember(req, res));
router.post('/members/remove', authenticate, (req, res) => TeamController.removeMember(req, res));

module.exports = router;
