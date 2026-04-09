const express = require('express');
const controller = require('../controllers/driverTripController');
const { requireLogin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireLogin);

router.get('/queue', controller.queue);
router.get('/:vehicleRequestId', controller.detail);
router.post('/:vehicleRequestId/morning', controller.logMorning);
router.post('/:vehicleRequestId/afternoon', controller.logAfternoon);

module.exports = router;