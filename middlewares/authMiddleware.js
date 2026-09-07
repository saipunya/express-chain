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
    const group = String(user?.group || user?.m_group || '').trim().toLowerCase();
    const mClass = String(user?.mClass || user?.m_class || '').trim().toLowerCase();
    return ['coop', 'group'].includes(group) || ['c', 'g'].includes(mClass);
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
    '/allCoop',
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

exports.requireOwnInstitution = (req, res, next) => {
    const user = req.session?.user;
    if (!isInstitutionUser(user)) return next();

    const requestedCode = String(req.params?.c_code || '').trim().toLowerCase();
    const ownCode = String(user.username || user.m_user || '').trim().toLowerCase();
    if (requestedCode && ownCode && requestedCode === ownCode) return next();

    return res.status(403).render('error_page', {
      message: 'บัญชีสถาบันสามารถดูได้เฉพาะข้อมูลของสถาบันตนเอง'
    });
};

exports.redirectInstitutionUsers = (req, res, next) => {
    if (!isInstitutionUser(req.session?.user)) {
      return next();
    }

    const path = req.path || '';
    const normalizedPath = path.toLowerCase();
    // Allow access to specific download or uploads paths even for institution users
    if (INSTITUTION_ALLOWED_PATHS.some((p) => normalizedPath.startsWith(p.toLowerCase()))) {
      return next();
    }
    if (normalizedPath === '/dashboard2' || normalizedPath.startsWith('/dashboard2/')) {
      return next();
    }

    if (normalizedPath.startsWith('/allcoop/profile/')) {
      let requestedCode = path.slice('/allCoop/profile/'.length);
      try {
        requestedCode = decodeURIComponent(requestedCode);
      } catch (_) {
        return res.redirect('/dashboard2');
      }
      requestedCode = requestedCode.trim().toLowerCase();
      const ownCode = String(req.session.user.username || req.session.user.m_user || '').trim().toLowerCase();
      if (requestedCode === ownCode) return next();
    }

    if (INSTITUTION_BLOCKED_PREFIXES.some((prefix) => {
      const normalizedPrefix = prefix.toLowerCase();
      return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
    })) {
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
