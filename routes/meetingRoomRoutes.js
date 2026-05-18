const express = require('express');
const router = express.Router();
const meetingCtrl = require('../controllers/meetingRoomController');
const { isAdminOrOwner } = require('../middleware/authMiddleware');

const isMeetingRoomAdmin = (req, res, next) => {
  const userClass = req.session?.user?.mClass;
  if (userClass === 'admin' || userClass === 'pbt') {
    return next();
  }
  return res.render('error_page', { message: 'ไม่มีสิทธิ์เข้าใช้งานหน้านี้' });
};

// Public: list bookings
router.get('/', meetingCtrl.list);

// Create (everyone)
router.get('/create', meetingCtrl.create);
router.post('/create', meetingCtrl.create);

// Admin/PBT only: edit
router.get('/edit/:id', isMeetingRoomAdmin, meetingCtrl.edit);
router.post('/edit/:id', isMeetingRoomAdmin, meetingCtrl.edit);

// Admin or owner: delete
router.post('/delete/:id', isAdminOrOwner, meetingCtrl.remove);

module.exports = router;
