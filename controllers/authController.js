const bcrypt = require('bcryptjs');
const authModel = require('../models/userModel');
const onlineModel = require('../models/onlineModel');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await authModel.findUserByUsername(username);

    if (!user) {
      // user wrong
      res.render('login_error', { error: 'ชื่อใช้งาน /รหัสผ่านไม่ถูกต้อง หรือ username ของท่านถูกแบน' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.m_pass);
    if (!isPasswordValid) {
      // pass wrong
      res.render('login_error', { error: 'ชื่อใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    // ตั้ง session - ใช้ m_id แทน id
    req.session.user = {
      id: user.m_id,  // เปลี่ยนจาก user.id เป็น user.m_id
      username: user.m_user,
      fullname: user.m_name,
      position: user.m_position,
      level: user.m_type,
      group: user.m_group,
      mClass: user.m_class,
      m_img: user.m_img
    };

    // rememberMe support: หากเลือกให้จำไว้ -> อายุคุกกี้ 30 วัน, ไม่เช็ค -> session ชั่วคราว (ปิดเบราว์เซอร์หลุด)
    if (req.body.rememberMe === 'on' || req.body.rememberMe === 'true' || req.body.rememberMe === true) {
      // 30 days
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 วัน
    } else {
      // ทำให้เป็น session cookie (ไม่ตั้ง expires / maxAge)
      req.session.cookie.expires = false; // browser session only
      delete req.session.cookie.maxAge;
    }

    // ข้อมูลออนไลน์
    await onlineModel.setUserOnline(user.m_id, user.m_name, req.sessionID);

    // Redirect to originally requested page if available and safe
    let redirectTo = req.session.returnTo;
    delete req.session.returnTo; // one-time use
    if (typeof redirectTo !== 'string' || !redirectTo.startsWith('/') || redirectTo.startsWith('/auth')) {
      redirectTo = '/dashboard';
    }
    return res.redirect(redirectTo);
  } catch (error) {
    console.error(error);
    res.status(500).send('error');
  }
};

exports.register = async (req, res) => {
  const { username, password, fullname, position, group } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await authModel.createUser({
      username,
      password: hashedPassword,
      fullname,
      position,
      group
    });

    res.redirect('/auth/login');
  } catch (error) {
    console.error('ข้อพลาดระหว่าง:', error);
    res.status(500).send('ไม่สำเร็จ');
  }
};
