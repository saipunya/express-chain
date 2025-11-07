const express = require('express');
const router = express.Router();
const meetingCtrl = require('../controllers/meetingRoomController');
const { isAdmin } = require('../middleware/authMiddleware');
const { validateCreate, handleValidation } = require('../validators/meetingRoomValidators'); // added

// Public: list bookings
router.get('/', meetingCtrl.list);

// Admin only: create
router.get('/create', isAdmin, meetingCtrl.createForm); // changed
router.post('/create', isAdmin, validateCreate(), handleValidation, meetingCtrl.create); // changed

// Admin only: edit
router.get('/edit/:id', isAdmin, meetingCtrl.edit);
router.post('/edit/:id', isAdmin, meetingCtrl.edit);

// Admin only: delete
router.post('/delete/:id', isAdmin, meetingCtrl.remove);

module.exports = router;
