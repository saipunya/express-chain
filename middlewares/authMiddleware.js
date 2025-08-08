const onlineModel = require('../models/onlineModel');

// middlewares/authMiddleware.js
exports.requireLogin = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    next();
  };
  
  exports.requireLevel = (requiredLevel) => {
    return (req, res, next) => {
      if (!req.session.user || req.session.user.level !== requiredLevel) {
        // ไม่ใช่แอดมินและไม่ได้เข้าสู่ระบบ
        res.render('requireLevel', { title: 'ไม่ได้เข้าหน้านี้' }); 
      }
      // next();
    };
  };
  
  // แนบ session.user ให้ใช้งานใน EJS ได้
  exports.setUserLocals = (req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  };

  // <lemmaปเดตเวลาออนไลน์เมื่อ<lemmaใช้งาน
  exports.updateOnlineTime = async (req, res, next) => {
    if (req.session.user) {
      try {
        await onlineModel.setUserOnline(
          req.session.user.id, 
          req.session.user.fullname, 
          req.sessionID
        );
      } catch (error) {
        console.error('Error updating online time:', error);
      }
    }
    next();
  };
  
