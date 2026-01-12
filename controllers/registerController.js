const bcrypt = require('bcryptjs');
const RegisterModel = require('../models/registerModel');

const ALLOWED_TYPES = [
  'ข้าราชการ', 'ลูกจ้างประจำ', 'พนักงานราชการ', 'จ้างเหมาบริการ',
  'สหกรณ์(สถาบัน)', 'กลุ่มเกษตรกร(สถาบัน)', 'สมาชิกสถาบัน'
];

// สังกัดที่อนุญาตให้สมัครได้
const ALLOWED_GROUPS = [
  'kjs', 'kps', 'kbs', 'kts', 'pbt',
  'group1', 'group2', 'group3', 'group4', 'group5'
];

// กรอง input และกัน pattern ที่ใช้ลอง SQL injection
const sanitizeText = (value) => {
  if (!value) return '';
  return String(value).trim();
};

// username: อนุญาตเฉพาะ a-zA-Z0-9 และ _.-
const USERNAME_REGEX = /^[A-Za-z0-9_.-]{4,30}$/;

// ชื่อ/ตำแหน่ง: อนุญาตตัวอักษรไทย อังกฤษ ช่องว่าง และ .,-
const NAME_REGEX = /^[0-9A-Za-zก-๙\s.,-]{2,100}$/;

// pattern ที่มักใช้ทดสอบ SQL injection เช่น ' OR 1=1 --
const SUSPICIOUS_PATTERN = /(--|\bOR\b|\bAND\b|['"%*=;]|\/\*|\*\/)/i;

exports.form = (req, res) => {
  res.render('register', { error: null });
};

exports.submit = async (req, res) => {
  try {
    const { username, fullname, position, email, group, password, m_type, m_org, hp_field } = req.body;

    // honeypot field: ถ้ามีค่าให้ถือว่าเป็นบอท ยิง spam -> ตัดทิ้งเงียบๆ
    if (hp_field && hp_field.toString().trim() !== '') {
      return res.status(400).send('ไม่สามารถสมัครสมาชิกได้');
    }

    const cleanUsername = sanitizeText(username);
    const cleanFullname = sanitizeText(fullname);
    const cleanPosition = sanitizeText(position);
    const cleanEmail = sanitizeText(email);

    if (!cleanUsername || !cleanFullname || !cleanPosition || !group || !password) {
      return res.status(400).send('กรอกข้อมูลให้ครบ');
    }
    if (password.length < 6) {
      return res.status(400).send('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
    }

    // ตรวจรูปแบบ username
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return res.status(400).send('รูปแบบชื่อผู้ใช้ไม่ถูกต้อง');
    }

    // กัน payload ทดสอบ SQL injection ใน field หลักๆ
    if (
      SUSPICIOUS_PATTERN.test(cleanUsername) ||
      SUSPICIOUS_PATTERN.test(cleanFullname) ||
      SUSPICIOUS_PATTERN.test(cleanPosition)
    ) {
      return res.status(400).send('ข้อมูลไม่ถูกต้อง');
    }

    // ตรวจรูปแบบชื่อ-นามสกุล / ตำแหน่ง แบบคร่าวๆ
    if (!NAME_REGEX.test(cleanFullname) || !NAME_REGEX.test(cleanPosition)) {
      return res.status(400).send('รูปแบบชื่อหรือชื่อตำแหน่งไม่ถูกต้อง');
    }

    // ตรวจว่ากลุ่ม (สังกัด) อยู่ในรายการที่กำหนดเท่านั้น
    if (!ALLOWED_GROUPS.includes(group)) {
      return res.status(400).send('สังกัดไม่ถูกต้อง');
    }

    // ตรวจซ้ำ username
    const existed = await RegisterModel.findByUser(cleanUsername);
    if (existed) return res.status(409).send('ชื่อผู้ใช้นี้ถูกใช้แล้ว');

    // ตรวจ ENUM ของ m_type
    const typeToUse = m_type && ALLOWED_TYPES.includes(m_type) ? m_type : 'จ้างเหมาบริการ';

    const hash = await bcrypt.hash(password, 10);

    await RegisterModel.create({
      m_user: cleanUsername,
      m_pass: hash,
      m_group: '',                 // ไม่ใช้ในฟอร์ม -> ค่าว่าง (ถูกกับ ENUM)
      m_name: cleanFullname,
      m_position: cleanPosition,
      m_head: '',
      m_usersystem: cleanEmail || '',
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