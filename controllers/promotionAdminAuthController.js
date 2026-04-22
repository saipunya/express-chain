const bcrypt = require('bcryptjs');
const adminUserModel = require('../models/promotion/adminUserModel');

function sanitizeUsername(raw) {
  return String(raw || '').trim().toLowerCase().slice(0, 100);
}

exports.showLogin = (req, res) => {
  const mainAdmin = req.session && req.session.user && req.session.user.mClass === 'admin';
  if (req.session && req.session.promotionAdmin) return res.redirect('/promotion/admin');
  if (mainAdmin) return res.redirect('/promotion/admin');

  return res.render('promotion/admin/login', {
    title: 'Promotion Admin Login',
    pageName: 'promotion-admin-login'
  });
};

exports.login = async (req, res) => {
  try {
    const username = sanitizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!username || !password) {
      req.flash('danger', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return res.redirect('/promotion/admin/login');
    }

    const user = await adminUserModel.getByUsername(username);
    if (!user || !user.is_active) {
      req.flash('danger', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return res.redirect('/promotion/admin/login');
    }

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) {
      req.flash('danger', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return res.redirect('/promotion/admin/login');
    }

    const role = user.role === 'super_admin' ? 'super_admin' : 'coop_admin';
    if (role === 'coop_admin' && !user.store_id) {
      req.flash('danger', 'บัญชี coop_admin ต้องผูก store_id');
      return res.redirect('/promotion/admin/login');
    }

    req.session.promotionAdmin = {
      id: user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      role,
      store_id: user.store_id || null
    };

    try {
      await adminUserModel.touchLastLogin(user.id);
    } catch (e) {
      console.warn('promotion admin touchLastLogin warning:', e && e.message);
    }

    req.flash('success', 'เข้าสู่ระบบสำเร็จ');
    let redirectTo = '/promotion/admin';
    if (req.session && typeof req.session.promotionAdminReturnTo === 'string') {
      const rt = req.session.promotionAdminReturnTo;
      if (rt.startsWith('/promotion/admin')) redirectTo = rt;
      delete req.session.promotionAdminReturnTo;
    }
    return res.redirect(redirectTo);
  } catch (err) {
    console.error('promotionAdminAuth.login error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    return res.redirect('/promotion/admin/login');
  }
};

exports.logout = (req, res) => {
  if (req.session) delete req.session.promotionAdmin;
  req.flash('success', 'ออกจากระบบแล้ว');
  return res.redirect('/promotion/admin/login');
};
