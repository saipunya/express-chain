// routes/promotionRoutes.js
const express = require('express');
const router = express.Router();
const flashMiddleware = require('../middlewares/flash');
const promotionController = require('../controllers/promotionController');
const promotionAdminController = require('../controllers/promotionAdminController');
const promotionAdminAuthController = require('../controllers/promotionAdminAuthController');
const promotionAdminAuth = require('../middlewares/promotionAdminAuth');
const promotionPrizeUpload = require('../middlewares/promotionPrizeUpload');

function handlePrizeUpload(req, res, next) {
  promotionPrizeUpload.single('image_file')(req, res, (err) => {
    if (!err) return next();
    const message = err && err.message ? err.message : 'อัปโหลดรูปของรางวัลไม่สำเร็จ';
    req.flash('danger', message);
    return res.redirect('/promotion/admin/prizes');
  });
}

// Apply flash middleware only to promotion routes (keeps changes local)
router.use(flashMiddleware());

router.get('/', promotionController.index);
router.get('/stores/play', promotionController.playStores);
router.get('/play', promotionController.play);
router.get('/store/:storeCode/play', promotionController.playByStore);
// Kiosk mode: single-screen, touch-friendly UI
router.get('/kiosk', promotionController.kiosk);
router.get('/store/:storeCode/kiosk', promotionController.kioskByStore);
// Kiosk AJAX endpoints (return JSON)
router.post('/kiosk/validate', promotionController.kioskValidate);
router.post('/kiosk/draw', promotionController.kioskDraw);
router.post('/kiosk/claim', promotionController.kioskClaim);
router.post('/kiosk/decline', promotionController.kioskDecline);
router.post('/validate-code', promotionController.validateCode);
router.post('/draw', promotionController.draw);
router.get('/claim/:token', promotionController.showClaimForm);
router.post('/claim', promotionController.claim);
router.post('/decline', promotionController.decline);
router.get('/result/:token', promotionController.result);
router.get('/admin/login', promotionAdminAuthController.showLogin);
router.post('/admin/login', promotionAdminAuthController.login);
router.post('/admin/logout', promotionAdminAuthController.logout);
router.get('/admin/logout', promotionAdminAuthController.logout);
router.use('/admin', promotionAdminAuth);
router.get('/admin', promotionAdminController.dashboard);
router.get('/admin/campaigns', promotionAdminController.campaigns);
router.post('/admin/campaigns', promotionAdminController.createCampaign);
router.post('/admin/campaigns/:id/update', promotionAdminController.updateCampaign);
router.post('/admin/campaigns/:id/status', promotionAdminController.updateCampaignStatus);
router.post('/admin/campaigns/:id/delete', promotionAdminController.deleteCampaign);
router.get('/admin/prizes', promotionAdminController.prizes);
router.post('/admin/prizes', handlePrizeUpload, promotionAdminController.createPrize);
router.post('/admin/prizes/:id/update', handlePrizeUpload, promotionAdminController.updatePrize);
router.post('/admin/prizes/:id/status', promotionAdminController.updatePrizeStatus);
router.post('/admin/prizes/:id/reconcile', promotionAdminController.reconcilePrizeInventory);
router.post('/admin/prizes/:id/delete', promotionAdminController.deletePrize);
router.get('/admin/codes', promotionAdminController.codes);
router.post('/admin/codes/generate', promotionAdminController.generateCodes);
router.post('/admin/codes/clear', promotionAdminController.clearCodes);
router.post('/admin/codes/reset', promotionAdminController.resetCodes);
router.post('/admin/codes/reset-hard', promotionAdminController.hardResetCodes);
router.get('/admin/draws', promotionAdminController.draws);
router.post('/admin/draws/clear-pending', promotionAdminController.clearPendingDraws);
router.get('/admin/stores', promotionAdminController.stores);
router.post('/admin/stores', promotionAdminController.createStore);
router.post('/admin/stores/:id/update', promotionAdminController.updateStore);
router.post('/admin/stores/:id/status', promotionAdminController.updateStoreStatus);
router.post('/admin/stores/:id/delete', promotionAdminController.deleteStore);
router.get('/admin/users', promotionAdminController.users);
router.post('/admin/users', promotionAdminController.createUser);
router.post('/admin/users/:id/update', promotionAdminController.updateUser);
router.post('/admin/users/:id/status', promotionAdminController.updateUserStatus);
router.post('/admin/users/:id/reset-password', promotionAdminController.resetUserPassword);
router.post('/admin/users/:id/delete', promotionAdminController.deleteUser);

// Friendly alias: /promotion/{storeCode} -> /promotion/store/{storeCode}/play
router.get('/:storeCode/kiosk', promotionController.kioskByStoreAlias);
router.get('/:storeCode', promotionController.playByStoreAlias);

module.exports = router;
