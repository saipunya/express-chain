'use strict';

const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const onlineModel = require('../models/onlineModel');
const memberPortalRepository = require('../repositories/debtMemberPortalRepository');
const { isInstitutionUser } = require('../services/debtAccessService');

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}

function renderStaffLogin(res, error = null, username = '') {
  return res.status(error ? 401 : 200).render('debt/staff-login', { title: 'เข้าสู่ระบบเจ้าหน้าที่', error, username });
}

function renderMemberLogin(res, error = null, username = '') {
  return res.status(error ? 401 : 200).render('debt/member-login', {
    title: 'เข้าสู่ระบบสมาชิก', error, username, showDemoCredentials: process.env.NODE_ENV !== 'production'
  });
}

exports.landing = (req, res) => res.render('debt/landing', {
  title: 'ระบบบริหารจัดการหนี้สหกรณ์', staffLoggedIn: Boolean(req.session?.user), memberLoggedIn: Boolean(req.session?.debtMember)
});

exports.staffLoginPage = (req, res) => {
  if (req.session?.user) return res.redirect(isInstitutionUser(req.session.user) ? '/debt/member-debt' : '/debt/dashboard');
  return renderStaffLogin(res);
};

exports.staffLogin = async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 100);
  const password = String(req.body?.password || '');
  const user = await userModel.findUserByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.m_pass))) return renderStaffLogin(res, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', username);

  await regenerateSession(req);
  req.session.user = {
    id: user.m_id, username: user.m_user, fullname: user.m_name, position: user.m_position,
    level: user.m_type, group: user.m_group, mClass: user.m_class, m_class: user.m_class, m_img: user.m_img
  };
  if (req.body.rememberMe) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  await onlineModel.setUserOnline(user.m_id, user.m_name, req.sessionID);
  return res.redirect(isInstitutionUser(req.session.user) ? '/debt/member-debt' : '/debt/dashboard');
};

exports.memberLoginPage = (req, res) => {
  if (req.session?.debtMember?.memberId) return res.redirect('/debt/member/overview');
  return renderMemberLogin(res);
};

exports.memberLogin = async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 100);
  const password = String(req.body?.password || '');
  const account = await memberPortalRepository.findAccountByUsername(username);
  const locked = account?.locked_until && new Date(account.locked_until).getTime() > Date.now();
  if (!account || !account.active || locked || !(await bcrypt.compare(password, account.password_hash))) {
    if (account && !locked) await memberPortalRepository.recordFailedLogin(account.id);
    return renderMemberLogin(res, locked ? 'บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง' : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', username);
  }

  await memberPortalRepository.recordSuccessfulLogin(account.id);
  const requestedReturnTo = req.session.memberReturnTo;
  await regenerateSession(req);
  req.session.debtMember = {
    accountId: Number(account.id), memberId: Number(account.member_id), memberNo: account.member_no,
    displayName: account.display_name, coopId: Number(account.coop_id), coopName: account.c_name,
    demo: Boolean(account.demo_flag), mustChangePassword: Boolean(account.must_change_password)
  };
  req.session.cookie.maxAge = req.body.rememberMe ? 30 * 24 * 60 * 60 * 1000 : null;
  const redirectTo = typeof requestedReturnTo === 'string' && requestedReturnTo.startsWith('/debt/member/')
    ? requestedReturnTo : '/debt/member/overview';
  return res.redirect(redirectTo);
};

exports.memberLogout = (req, res) => {
  delete req.session.debtMember;
  delete req.session.memberReturnTo;
  req.session.save(() => res.redirect('/debt/member/login?loggedOut=1'));
};
