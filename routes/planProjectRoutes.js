const express = require('express');
const router = express.Router();
const controller = require('../controllers/planProjectController');
const budgetDisbursalController = require('../controllers/planBudgetDisbursalController');

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');
const { requireAdminOrResponsibleByProjectId, requireAdminOrResponsibleByProjectCode } = require('../middlewares/projectAccess');

// Allow public access to summary page
router.get('/summary/:code', controller.summaryPage);

// Budget Disbursal routes (for project managers/admins)
// Note: More specific routes must come before parameterized routes
router.get('/budget_disbursal/export', requireLogin, budgetDisbursalController.exportCSV);
router.get('/budget_disbursal', requireLogin, budgetDisbursalController.list);
router.post('/budget_disbursal', requireLogin, budgetDisbursalController.store);
router.delete('/budget_disbursal/:id', requireLogin, budgetDisbursalController.delete);

// All other routes require login
router.use(requireLogin);

const requireAdminOrPbt = requireLevel(['admin', 'pbt']);
const requireAdmin = requireLevel(['admin']);
const requireAdminOrResponForProject = requireAdminOrResponsibleByProjectId((req) => req.params.id);

router.get('/disbursal-dashboard', requireAdminOrPbt, controller.disbursalDashboardPage);

router.get('/', requireAdminOrPbt, controller.listPage);
router.get('/activities-overview', requireLogin, controller.activitiesOverviewPage);
router.get('/new', requireAdminOrPbt, controller.newPage);
router.post('/', requireAdminOrPbt, controller.create);

// Edit/update: only admin or project responsible
router.get('/edit/:id', requireAdminOrResponForProject, controller.editPage);
router.post('/edit/:id', requireAdminOrResponForProject, controller.update);

// Delete: admin only
router.post('/delete/:id', requireAdmin, controller.delete);

module.exports = router;
