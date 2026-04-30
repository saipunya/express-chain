const onlineModel = require('../models/onlineModel');

function setNoCacheHeaders(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
}

exports.noCache = (req, res, next) => {
    setNoCacheHeaders(res);
    next();
};

function isInstitutionUser(user) {
    return ['coop', 'group'].includes(String(user?.group || user?.m_group || '').trim());
}

const INSTITUTION_BLOCKED_PREFIXES = [
    '/dashboard',
    '/plan',
    '/planKpi',
    '/planproject',
    '/plan_project',
    '/project',
    '/official-travel',
    '/vehicle-request',
    '/vehicle-approval',
    '/vehicle-master',
    '/driver-master',
    '/driver-trip',
    '/gitgum',
    '/member',
    '/addmem',
    '/activeCoop',
    '/auditlog',
    '/bigmeet',
    '/business',
    '/command',
    '/cooperatives-assets',
    '/down',
    '/finance',
    '/newstrength',
    '/rabiab',
    '/rq2',
    '/rule',
    '/strength',
    '/suggestion',
    '/turnover',
    '/usecar',
    '/vong',
    '/vong-business'
];

// Allowlist: paths that institution users should still be able to access (download endpoints, public uploads)
const INSTITUTION_ALLOWED_PATHS = [
  '/finance/download',
  '/business/download',
  '/rabiab/download',
  '/vong/download',
  '/rq2/download',
  '/rule/', // rule detail/download endpoints use /rule/:id or /rule/file/:id
  '/uploads/'
];

exports.isInstitutionUser = isInstitutionUser;

exports.redirectInstitutionUsers = (req, res, next) => {
    if (!isInstitutionUser(req.session?.user)) {
      return next();
    }

    const path = req.path || '';
    // Allow access to specific download or uploads paths even for institution users
    if (INSTITUTION_ALLOWED_PATHS.some((p) => path.startsWith(p))) {
      return next();
    }
    if (path === '/dashboard2' || path.startsWith('/dashboard2/')) {
      return next();
    }

    if (INSTITUTION_BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return res.redirect('/dashboard2');
    }

    next();
};

// middlewares/authMiddleware.js
exports.requireLogin = (req, res, next) => {
    setNoCacheHeaders(res);

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
