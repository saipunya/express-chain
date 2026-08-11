'use strict';

const crypto = require('crypto');
const { resolveAccess, canAccessCoop } = require('../services/debtAccessService');

async function attachDebtAccess(req, res, next) {
  try {
    req.debtAccess = await resolveAccess(req.session?.user);
    if (!req.debtAccess) return res.redirect('/auth/login?returnTo=' + encodeURIComponent(req.originalUrl));
    res.locals.debtAccess = req.debtAccess;
    res.locals.debtMoney = (value) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    res.locals.debtNumber = (value) => Number(value || 0).toLocaleString('th-TH');
    res.locals.debtDate = (value) => value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '-';
    res.locals.debtRiskThai = (risk) => ({ RED: 'เร่งด่วน', ORANGE: 'ต้องติดตาม', YELLOW: 'เฝ้าระวัง', GREEN: 'ปกติ', UNKNOWN: 'รอตรวจสอบ' }[risk] || risk || '-');
    if (!req.session.debtCsrfToken) req.session.debtCsrfToken = crypto.randomBytes(24).toString('hex');
    res.locals.debtCsrfToken = req.session.debtCsrfToken;
    next();
  } catch (error) {
    next(error);
  }
}

function requireProvince(req, res, next) {
  if (req.debtAccess?.provinceWide) return next();
  return res.status(403).render('debt/error', { status: 403, message: 'บัญชีสหกรณ์ไม่สามารถดูภาพรวมระดับจังหวัดได้' });
}

function requireCoopAccess(paramName = 'coopId') {
  return (req, res, next) => {
    if (canAccessCoop(req.debtAccess, req.params[paramName])) return next();
    return res.status(403).render('debt/error', { status: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของสหกรณ์นี้' });
  };
}

function verifyCsrf(req, res, next) {
  const supplied = String(req.body?._csrf || '');
  const expected = String(req.session?.debtCsrfToken || '');
  if (supplied && expected && supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return next();
  }
  return res.status(403).render('debt/error', { status: 403, message: 'แบบฟอร์มหมดอายุ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง' });
}

module.exports = { attachDebtAccess, requireProvince, requireCoopAccess, verifyCsrf };
