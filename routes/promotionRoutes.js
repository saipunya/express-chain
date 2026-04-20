// routes/promotionRoutes.js
const express = require('express');
const router = express.Router();
const flashMiddleware = require('../middlewares/flash');
const promotionController = require('../controllers/promotionController');
const promotionAdminController = require('../controllers/promotionAdminController');
const promotionAdminAuth = require('../middlewares/promotionAdminAuth');

// Apply flash middleware only to promotion routes (keeps changes local)
router.use(flashMiddleware());

router.get('/', promotionController.index);
router.get('/play', promotionController.play);
// Kiosk mode: single-screen, touch-friendly UI
router.get('/kiosk', promotionController.kiosk);
// Kiosk AJAX endpoints (return JSON)
router.post('/kiosk/validate', promotionController.kioskValidate);
router.post('/kiosk/draw', promotionController.kioskDraw);
router.post('/kiosk/claim', promotionController.kioskClaim);
router.post('/kiosk/decline', promotionController.kioskDecline);
router.post('/validate-code', promotionController.validateCode);
router.post('/draw', promotionController.draw);
router.post('/claim', promotionController.claim);
router.post('/decline', promotionController.decline);
router.get('/result/:token', promotionController.result);
router.get('/admin', promotionAdminAuth, promotionAdminController.dashboard);
router.get('/admin/campaigns', promotionAdminAuth, promotionAdminController.campaigns);
router.get('/admin/prizes', promotionAdminAuth, promotionAdminController.prizes);
router.get('/admin/codes', promotionAdminAuth, promotionAdminController.codes);
router.post('/admin/codes/generate', promotionAdminAuth, promotionAdminController.generateCodes);
router.get('/admin/draws', promotionAdminAuth, promotionAdminController.draws);

module.exports = router;
