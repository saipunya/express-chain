const express = require('express');
const router = express.Router();
const controller = require('../controllers/planActivityController');

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');
const { requireAdminOrResponsibleByProjectCode } = require('../middlewares/projectAccess');

// API: Get activities by project code (no auth required)
router.get('/api/by-project', controller.getActivitiesByProject);

router.use(requireLogin);

const requireAdminOrResponForReport = requireAdminOrResponsibleByProjectCode(
	(req) => (req.method === 'GET' ? req.query.pro_code : req.body.pro_code)
);
const requireAdminOrPbt = requireLevel(['admin', 'pbt']);

router.get('/', requireAdminOrPbt, controller.index);
router.get('/select', requireAdminOrPbt, controller.selectProjectPage);
router.get('/create', requireAdminOrPbt, controller.create);
router.get('/create-many', requireAdminOrPbt, controller.createMany);
router.post('/store', requireAdminOrPbt, controller.store);
router.post('/store-many', requireAdminOrPbt, controller.storeMany);

// Monthly reporting: only admin or project responsible
router.get('/report', (req, res, next) => {
	// Allow opening the page without selecting a project (it will show only owned projects unless admin)
	if (!req.query.pro_code && req.session?.user?.mClass !== 'admin') return next();
	if (!req.query.pro_code && req.session?.user?.mClass === 'admin') return next();
	return requireAdminOrResponForReport(req, res, next);
}, controller.monthlyReport);
router.post('/report', requireAdminOrResponForReport, controller.storeMonthlyStatuses);
router.post('/report/kpi', requireAdminOrResponForReport, controller.storeMonthlyKpi);

router.get('/:id/edit', requireAdminOrPbt, controller.edit);
router.post('/:id/update', requireAdminOrPbt, controller.update);
router.post('/:id/delete', requireAdminOrPbt, controller.destroy);
router.get('/:id', requireAdminOrPbt, controller.show);

module.exports = router;
