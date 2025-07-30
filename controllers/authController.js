const bcrypt = require('bcryptjs');
const authModel = require('../models/userModel');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await authModel.findUserByUsername(username);

    if (!user) {
      return res.status(401).send('ไม่พบบัญชีผู้ใช้นี้');
    }
    console.log(`User password: ${user.m_pass}`);

    const isPasswordValid = await bcrypt.compare(password, user.m_pass);
    if (!isPasswordValid) {
      return res.status(401).send('รหัสผ่านไม่ถูกต้อง');
    }






    
    // ตั้ง session หรือ token ตามที่ต้องการ
    req.session.user = {
      id: user.id,
      username: user.m_user,
      fullname: user.m_name,
      position: user.m_position,
      level: user.m_type
    };

    res.redirect('/dashboard'); // หรือเส้นทางที่ต้องการหลังล็อกอิน
  } catch (error) {
    console.error(error);
    res.status(500).send('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
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

    res.redirect('/login'); // สมัครเสร็จให้ไปล็อกอิน
  } catch (error) {
    console.error('เกิดข้อผิดพลาดระหว่างสมัครสมาชิก:', error);
    res.status(500).send('สมัครไม่สำเร็จ');
  }
};
