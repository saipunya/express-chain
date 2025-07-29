// middlewares/authMiddleware.js
exports.requireLogin = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
  };
  
  exports.requireLevel = (requiredLevel) => {
    return (req, res, next) => {
      if (!req.session.user || req.session.user.level !== requiredLevel) {
        return res.status(403).send('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      }
      next();
    };
  };
  
  // แนบ session.user ให้ใช้งานใน EJS ได้ทุกหน้า
  exports.setUserLocals = (req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  };
  