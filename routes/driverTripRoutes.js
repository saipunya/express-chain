const express = require('express');
const controller = require('../controllers/driverTripController');
const { requireLevel, requireLogin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireLogin);

router.get('/queue', controller.queue);
router.post('/:vehicleRequestId/assignment', requireLevel(['admin', 'pbt']), controller.updateAssignment);
router.post('/:vehicleRequestId/cancel', requireLevel(['admin', 'pbt']), controller.cancelQueueItem);
router.get('/report', controller.report);
router.get('/report/pdf', controller.exportReportPdf);
router.get('/:vehicleRequestId', controller.detail);
router.post('/:vehicleRequestId/morning', controller.logMorning);
router.post('/:vehicleRequestId/afternoon', controller.logAfternoon);

module.exports = router;
