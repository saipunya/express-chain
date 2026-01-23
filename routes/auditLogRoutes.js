const express = require('express');
const router = express.Router();

const controller = require('../controllers/auditLogController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

router.use(requireLogin, requireLevel(['admin']));

router.get('/', controller.index);
router.get('/:id', controller.show);

module.exports = router;
