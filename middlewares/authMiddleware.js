const onlineModel = require('../models/onlineModel');

// middlewares/authMiddleware.js
exports.requireLogin = (req, res, next) => {
    if (!req.session.user) {
      // Remember where the user wanted to go (GET only, and not auth pages)
      const wantsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      const isAuthPath = req.originalUrl && req.originalUrl.startsWith('/auth');
      if (!isAuthPath) {
        if (req.method === 'GET') {
          req.session.returnTo = req.originalUrl;
        } else if (wantsHtml) {
          // For non-GET HTML requests, fallback to referrer
          const referer = req.get('referer');
          if (referer && !referer.includes('/auth/')) {
            req.session.returnTo = referer;
          }
        }
      }
      return res.redirect('/auth/login');
    }
    next();
  };
  
  function hasRequiredLevel(user, requiredLevel) {
    if (!user) {
      return false;
    }

    const allowedLevels = Array.isArray(requiredLevel) ? requiredLevel : [requiredLevel];
    const userLevels = [user.mClass, user.m_class, user.level]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    return userLevels.some((level) => allowedLevels.includes(level));
  }

  exports.requireLevel = (requiredLevel) => {
    return (req, res, next) => {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      if (!hasRequiredLevel(req.session.user, requiredLevel)) {
        return res.render('requireLevel', { title: 'ไม่ได้เข้าหน้านี้' }); 
      }

      next();
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

// ลบ module.exports ตัวเดิมออกแล้วใช้ตัวเดียวกับ requireLogin
exports.isAuth = exports.requireLogin;
