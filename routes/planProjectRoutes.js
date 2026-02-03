const express = require('express');
const router = express.Router();
const controller = require('../controllers/planProjectController');

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');
const { requireAdminOrResponsibleByProjectId, requireAdminOrResponsibleByProjectCode } = require('../middlewares/projectAccess');

router.use(requireLogin);

const requireAdminOrPbt = requireLevel(['admin', 'pbt']);
const requireAdmin = requireLevel(['admin']);
const requireAdminOrResponForProject = requireAdminOrResponsibleByProjectId((req) => req.params.id);

router.get('/', requireAdminOrPbt, controller.listPage);
router.get('/activities-overview', requireAdminOrPbt, controller.activitiesOverviewPage);
router.get('/new', requireAdminOrPbt, controller.newPage);
router.post('/', requireAdminOrPbt, controller.create);
router.get('/summary/:code', requireAdminOrResponsibleByProjectCode((req) => req.params.code), controller.summaryPage);

// Edit/update: only admin or project responsible
router.get('/edit/:id', requireAdminOrResponForProject, controller.editPage);
router.post('/edit/:id', requireAdminOrResponForProject, controller.update);

// Delete: admin only
router.post('/delete/:id', requireAdmin, controller.delete);

module.exports = router;
