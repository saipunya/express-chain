const express = require('express');
const router = express.Router();
const meetingCtrl = require('../controllers/meetingRoomController');
const { isAdmin } = require('../middleware/authMiddleware');

// Public: list bookings
router.get('/', meetingCtrl.list);

// Create (everyone)
router.get('/create', meetingCtrl.create);
router.post('/create', meetingCtrl.create);

// Admin only: edit
router.get('/edit/:id', isAdmin, meetingCtrl.edit);
router.post('/edit/:id', isAdmin, meetingCtrl.edit);

// Admin only: delete
router.post('/delete/:id', isAdmin, meetingCtrl.remove);

module.exports = router;
