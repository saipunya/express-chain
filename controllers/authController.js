const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');

exports.register = async (req, res) => {
  const { username, fullname, position, group, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await UserModel.createUser({
      username,
      fullname,
      position,
      group,
      email,
      hashedPassword
    });

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดขณะลงทะเบียน');
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await UserModel.findUserByUsername(username);

    if (!user || user.m_status !== 'active') {
      return res.send('ไม่พบผู้ใช้ หรือบัญชีถูกปิดใช้งาน');
    }

    const isMatch = await bcrypt.compare(password, user.tbl_password);
    if (!isMatch) {
      return res.send('รหัสผ่านไม่ถูกต้อง');
    }

    req.session.user = {
      id: user.tbl_id,
      username: user.m_user,
      fullname: user.m_name,
      position: user.m_position,
      class: user.m_class,
      img: user.m_img
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดขณะเข้าสู่ระบบ');
  }
};
