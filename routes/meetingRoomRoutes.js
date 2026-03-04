const express = require('express');
const router = express.Router();
const meetingCtrl = require('../controllers/meetingRoomController');
const { isAdmin, isAdminOrOwner } = require('../middleware/authMiddleware');

// Public: list bookings
router.get('/', meetingCtrl.list);

// Create (everyone)
router.get('/create', meetingCtrl.create);
router.post('/create', meetingCtrl.create);

// Admin only: edit
router.get('/edit/:id', isAdmin, meetingCtrl.edit);
router.post('/edit/:id', isAdmin, meetingCtrl.edit);

// Admin or owner: delete
router.post('/delete/:id', isAdminOrOwner, meetingCtrl.remove);

module.exports = router;
