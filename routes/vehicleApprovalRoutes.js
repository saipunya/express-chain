const express = require('express');
const controller = require('../controllers/vehicleApprovalController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireLogin, requireLevel(['admin', 'kjs']));

router.get('/pending', controller.pending);
router.get('/travel/:id', controller.travelDetail);
router.post('/travel/:id/approve', controller.approveTravel);
router.post('/travel/:id/reject', controller.rejectTravel);
router.get('/request/:id', controller.vehicleDetail);
router.post('/request/:id/approve', controller.approveVehicle);
router.post('/request/:id/reject', controller.rejectVehicle);
router.post('/request/:id/assign', controller.assignVehicle);

module.exports = router;
