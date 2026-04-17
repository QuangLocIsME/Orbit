const express = require('express');
const RoleController = require('../controllers/RoleController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authenticate, (req, res) => RoleController.getRoles(req, res));
router.post('/create', authenticate, (req, res) => RoleController.createRole(req, res));
router.put('/:roleId', authenticate, (req, res) => RoleController.updateRole(req, res));
router.delete('/:roleId', authenticate, (req, res) => RoleController.deleteRole(req, res));

module.exports = router;
