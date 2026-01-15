const express = require('express');
const router = express.Router();
const controller = require('../controllers/planMainController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

// Only logged-in users with mClass = admin or pbt
router.use(requireLogin, requireLevel(['admin', 'pbt']));

// web UI
router.get('/', controller.listPage);
router.get('/new', controller.newPage);
router.post('/', controller.create);

// simple API
router.get('/api', controller.apiList);
router.delete('/api/:id', controller.apiDelete);

module.exports = router;
