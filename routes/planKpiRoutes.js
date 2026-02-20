const express = require('express');
const router = express.Router();
const controller = require('../controllers/planKpiController');

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');
const { requireAdminOrResponsibleByKpiId } = require('../middlewares/projectAccess');

router.use(requireLogin);

const requireAdminOrPbt = requireLevel(['admin', 'pbt']);
const requireAdminOrResponForKpi = requireAdminOrResponsibleByKpiId((req) => req.params.id);

router.get('/', requireAdminOrPbt, controller.index);
router.get('/overview', requireAdminOrPbt, controller.overview);
router.get('/create', requireAdminOrPbt, controller.create);
router.post('/store', requireAdminOrPbt, controller.store);

// Reporting: only admin or project responsible
router.get('/:id/report', requireAdminOrResponForKpi, controller.report);
router.post('/:id/report', requireAdminOrResponForKpi, controller.storeMonthly);
router.post('/:id/report/:reportId/delete', requireAdminOrResponForKpi, controller.destroyMonthly);

router.get('/:id/edit', requireAdminOrPbt, controller.edit);
router.post('/:id/update', requireAdminOrPbt, controller.update);
router.post('/:id/delete', requireAdminOrPbt, controller.destroy);

module.exports = router;
