const bcrypt = require('bcryptjs');
const RegisterModel = require('../models/registerModel');

exports.form = (req, res) => {
  res.render('register', { error: null });
};

exports.submit = async (req, res) => {
  try {
    const { username, fullname, position, email, group, password, m_type } = req.body;

    if (!username || !fullname || !position || !group || !password) {
      return res.status(400).send('กรอกข้อมูลให้ครบ');
    }
    if (password.length < 6) {
      return res.status(400).send('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
    }

    const existed = await RegisterModel.findByUser(username);
    if (existed) return res.status(409).send('ชื่อผู้ใช้นี้ถูกใช้แล้ว');

    const hash = await bcrypt.hash(password, 10);

    await RegisterModel.create({
      m_user: username,
      m_pass: hash,
      m_group: 'cpd',                 // ไม่ใช้จากฟอร์มนี้ กำหนดเริ่มต้นเป็นค่าว่าง
      m_name: fullname,
      m_position: position,
      m_head: '',
      m_usersystem: email || '',
      m_type: m_type = 'จ้างเหมาบริการ', // ไม่ใช้จากฟอร์มนี้ กำหนดเริ่มต้น
      m_org: '',
      m_class: group,              // แมป select “group” -> m_class
      m_pic: '',
      m_status: 'wait',
      m_img: ''
    });

    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('สมัครสมาชิกไม่สำเร็จ');
  }
};