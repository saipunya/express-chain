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

    if (!user || user.tbl_status !== 'active') {
      return res.send('ไม่พบผู้ใช้ หรือบัญชีถูกปิดใช้งาน');
    }

    const isMatch = await bcrypt.compare(password, user.tbl_password);
    if (!isMatch) {
      return res.send('รหัสผ่านไม่ถูกต้อง');
    }

    req.session.user = {
      id: user.tbl_id,
      username: user.tbl_username,
      fullname: user.tbl_fullname,
      position: user.tbl_position,
      group: user.tbl_group,
      level: user.tbl_level
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดขณะเข้าสู่ระบบ');
  }
};
