// ...existing code...

exports.isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.mClass === 'admin') {
    return next();
  }
  res.render('error_page', { message: 'ไม่มีสิทธิ์เข้าใช้งานหน้านี้' });
};

// Check if user is admin or owner of the meeting room booking
exports.isAdminOrOwner = async (req, res, next) => {
  if (!req.session.user) {
    return res.render('error_page', { message: 'กรุณาเข้าสู่ระบบ' });
  }
  
  // Admin can delete any booking
  if (req.session.user.mClass === 'admin') {
    return next();
  }
  
  // Check if user owns this booking
  const meetingModel = require('../models/meetingRoomModel');
  try {
    const meeting = await meetingModel.getById(req.params.id);
    if (!meeting) {
      return res.status(404).render('error_page', { message: 'ไม่พบข้อมูลการจอง' });
    }
    
    // Check if the current user is the one who created the booking
    if (meeting.mee_saveby === req.session.user.fullname || meeting.mee_saveby === req.session.user.username) {
      return next();
    }
    
    res.render('error_page', { message: 'ไม่มีสิทธิ์ลบรายการนี้' });
  } catch (err) {
    console.error('Error checking meeting ownership:', err);
    res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาด' });
  }
};
