const express = require('express');
const router = express.Router();
const controller = require('../controllers/planKpiController');

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

// Only logged-in users with mClass = admin or pbt
router.use(requireLogin, requireLevel(['admin', 'pbt']));

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/store', controller.store);
router.get('/:id/edit', controller.edit);
router.post('/:id/update', controller.update);
router.post('/:id/delete', controller.destroy);

module.exports = router;
