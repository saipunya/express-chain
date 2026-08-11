'use strict';

const express = require('express');
const controller = require('../controllers/debtController');
const debtAuthController = require('../controllers/debtAuthController');
const memberPortalController = require('../controllers/debtMemberPortalController');
const auth = require('../middlewares/authMiddleware');
const debtAuth = require('../middlewares/debtAuthMiddleware');
const debtLogin = require('../middlewares/debtLoginMiddleware');

const router = express.Router();

router.get('/', debtAuthController.landing);
router.get('/login', debtLogin.addPublicCsrf, debtAuthController.staffLoginPage);
router.post('/login', debtLogin.loginRateLimit, debtLogin.verifyPublicCsrf, debtAuthController.staffLogin);
router.get('/member/login', debtLogin.addPublicCsrf, debtAuthController.memberLoginPage);
router.post('/member/login', debtLogin.loginRateLimit, debtLogin.verifyPublicCsrf, debtAuthController.memberLogin);
router.post('/member/logout', debtLogin.requireMemberPortal, debtLogin.verifyMemberCsrf, debtAuthController.memberLogout);
router.get('/member/overview', debtLogin.requireMemberPortal, memberPortalController.overview);
router.get('/member/loans/:loanId', debtLogin.requireMemberPortal, memberPortalController.loan);

router.use(auth.requireLogin, debtAuth.attachDebtAccess);
router.get('/dashboard', controller.dashboard);
router.get('/cdf', controller.cdfDashboard);
router.get('/cdf/cooperatives/:coopId', debtAuth.requireCoopAccess(), controller.cdfCooperative);
router.get('/cdf/contracts/:contractId', controller.cdfContract);
router.post('/cdf/contracts/:contractId/followups', debtAuth.verifyCsrf, controller.addCdfFollowup);
router.get('/member-debt', controller.memberDashboard);
router.get('/member-debt/cooperatives/:coopId', debtAuth.requireCoopAccess(), controller.memberCooperative);
router.get('/member-debt/members/:memberId', controller.memberDetail);
router.get('/member-debt/loans/:loanId', controller.loanDetail);
router.post('/member-debt/loans/:loanId/followups', debtAuth.verifyCsrf, controller.addMemberFollowup);
router.get('/member-debt/imports', controller.imports);
router.get('/tasks', controller.tasks);

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[DEBT_MODULE_ERROR]', { requestId: req._rid, message: error.message, stack: error.stack });
  const status = Number(error.status) || 500;
  res.status(status).render('debt/error', viewDataForError(req, status, status === 500 ? 'ระบบไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่' : error.message));
});

function viewDataForError(req, status, message) {
  return { title: 'เกิดข้อผิดพลาด', basePath: '/debt', currentPath: req.path, query: req.query || {}, status, message };
}

module.exports = router;
