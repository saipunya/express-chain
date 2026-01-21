const express = require('express');
const router = express.Router();
const controller = require('../controllers/planActivityController');

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

// Only logged-in users with mClass = admin or pbt
router.use(requireLogin, requireLevel(['admin', 'pbt']));

router.get('/', controller.index);
router.get('/select', controller.selectProjectPage);
router.get('/create', controller.create);
router.get('/create-many', controller.createMany);
router.post('/store', controller.store);
router.post('/store-many', controller.storeMany);
router.get('/report', controller.monthlyReport);
router.post('/report', controller.storeMonthlyStatuses);
router.post('/report/kpi', controller.storeMonthlyKpi);
router.get('/:id/edit', controller.edit);
router.post('/:id/update', controller.update);
router.post('/:id/delete', controller.destroy);
router.get('/:id', controller.show);

module.exports = router;
