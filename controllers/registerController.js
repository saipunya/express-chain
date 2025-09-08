const bcrypt = require('bcryptjs');
const RegisterModel = require('../models/registerModel');

const ALLOWED_TYPES = [
  'ข้าราชการ','ลูกจ้างประจำ','พนักงานราชการ','จ้างเหมาบริการ',
  'สหกรณ์(สถาบัน)','กลุ่มเกษตรกร(สถาบัน)','สมาชิกสถาบัน'
];

exports.form = (req, res) => {
  res.render('register', { error: null });
};

exports.submit = async (req, res) => {
  try {
    const { username, fullname, position, email, group, password, m_type, m_org } = req.body;

    if (!username || !fullname || !position || !group || !password) {
      return res.status(400).send('กรอกข้อมูลให้ครบ');
    }
    if (password.length < 6) {
      return res.status(400).send('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
    }

    // ตรวจซ้ำ username
    const existed = await RegisterModel.findByUser(username);
    if (existed) return res.status(409).send('ชื่อผู้ใช้นี้ถูกใช้แล้ว');

    // ตรวจ ENUM ของ m_type
    const typeToUse = m_type && ALLOWED_TYPES.includes(m_type) ? m_type : 'จ้างเหมาบริการ';

    const hash = await bcrypt.hash(password, 10);

    await RegisterModel.create({
      m_user: username,
      m_pass: hash,
      m_group: '',                 // ไม่ใช้ในฟอร์ม -> ค่าว่าง (ถูกกับ ENUM)
      m_name: fullname,
      m_position: position,
      m_head: '',
      m_usersystem: email || '',
      m_type: typeToUse,
      m_org: m_org || '',
      m_class: group,              // map สังกัด -> m_class
      m_pic: '',
      m_status: 'wait',
      m_img: ''
    });

    res.redirect('/login');
  } catch (err) {
    console.error('Register error:', err.code, err.sqlMessage || err.message);
    if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.code === 'ER_WRONG_VALUE_FOR_FIELD') {
      return res.status(400).send('ค่าไม่ตรงตาม ENUM ของฐานข้อมูล');
    }
    res.status(500).send('สมัครสมาชิกไม่สำเร็จ');
  }
};