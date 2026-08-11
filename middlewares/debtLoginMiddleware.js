'use strict';

const crypto = require('crypto');

const attempts = new Map();

function addPublicCsrf(req, res, next) {
  if (!req.session.debtLoginCsrf) req.session.debtLoginCsrf = crypto.randomBytes(24).toString('hex');
  res.locals.debtLoginCsrf = req.session.debtLoginCsrf;
  next();
}

function verifyPublicCsrf(req, res, next) {
  const supplied = String(req.body?._csrf || '');
  const expected = String(req.session?.debtLoginCsrf || '');
  if (supplied && supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    res.locals.debtLoginCsrf = expected;
    return next();
  }
  return res.status(403).render('debt/auth-error', { title: 'แบบฟอร์มหมดอายุ', message: 'กรุณากลับไปหน้าเข้าสู่ระบบแล้วลองอีกครั้ง' });
}

function loginRateLimit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else {
    current.count += 1;
    if (current.count > 10) return res.status(429).render('debt/auth-error', { title: 'ลองเข้าสู่ระบบบ่อยเกินไป', message: 'กรุณารอ 15 นาทีแล้วลองใหม่' });
  }
  next();
}

function requireMemberPortal(req, res, next) {
  if (req.session?.debtMember?.memberId) {
    if (!req.session.debtMemberCsrf) req.session.debtMemberCsrf = crypto.randomBytes(24).toString('hex');
    res.locals.debtMember = req.session.debtMember;
    res.locals.debtMemberCsrf = req.session.debtMemberCsrf;
    return next();
  }
  req.session.memberReturnTo = req.originalUrl;
  return res.redirect('/debt/member/login');
}

function verifyMemberCsrf(req, res, next) {
  const supplied = String(req.body?._csrf || '');
  const expected = String(req.session?.debtMemberCsrf || '');
  if (supplied && supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return next();
  return res.status(403).render('debt/auth-error', { title: 'แบบฟอร์มหมดอายุ', message: 'กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง' });
}

module.exports = { addPublicCsrf, verifyPublicCsrf, loginRateLimit, requireMemberPortal, verifyMemberCsrf };
