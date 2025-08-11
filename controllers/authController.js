const bcrypt = require('bcryptjs');
const authModel = require('../models/userModel');
const onlineModel = require('../models/onlineModel');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await authModel.findUserByUsername(username);

    if (!user) {
      // user wrong
      res.render('login_error', { error: 'ชื่อใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
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

    // ข้อมูลออนไลน์
    await onlineModel.setUserOnline(user.m_id, user.m_name, req.sessionID);

    res.redirect('/dashboard');
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

    res.redirect('auth/login'); //  เสร็จให้ไปล็อก
  } catch (error) {
    console.error('ข้อพลาดระหว่าง:', error);
    res.status(500).send('ไม่สำเร็จ');
  }
};
