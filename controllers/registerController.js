const bcrypt = require('bcryptjs');
const RegisterModel = require('../models/registerModel');
const activeCoopModel = require('../models/activeCoopModel');

const ALLOWED_TYPES = [
  'ข้าราชการ', 'ลูกจ้างประจำ', 'พนักงานราชการ', 'จ้างเหมาบริการ',
  'สหกรณ์(สถาบัน)', 'กลุ่มเกษตรกร(สถาบัน)', 'ประธานกรรมการ', 'กรรมการ', 'ผู้จัดการ', 'เจ้าหน้าที่สหกรณ์'
];

const ALLOWED_MEMBER_GROUPS = ['cpd', 'coop', 'group'];

const COOP_TYPES = ['สหกรณ์(สถาบัน)', 'ประธานกรรมการ', 'กรรมการ', 'ผู้จัดการ', 'เจ้าหน้าที่สหกรณ์'];
const FARMER_GROUP_TYPES = ['กลุ่มเกษตรกร(สถาบัน)'];
const CPD_TYPES = ['ข้าราชการ', 'ลูกจ้างประจำ', 'พนักงานราชการ', 'จ้างเหมาบริการ'];

// สังกัด/สิทธิ์กลุ่มที่อนุญาตให้สมัครได้สำหรับเจ้าหน้าที่
const ALLOWED_CPD_CLASSES = [
  'kjs', 'kps', 'kbs', 'kts', 'pbt',
  'group1', 'group2', 'group3', 'group4', 'group5'
];

// กรอง input และกัน pattern ที่ใช้ลอง SQL injection
const sanitizeText = (value) => {
  if (!value) return '';
  return String(value).trim();
};

// username สำหรับเจ้าหน้าที่ทั่วไป: อนุญาตเฉพาะ a-zA-Z0-9 และ _.-
const USERNAME_REGEX = /^[A-Za-z0-9_.-]{3,30}$/;

// username สำหรับสหกรณ์/กลุ่มเกษตรกร: ใช้ c_code ซึ่งอาจสั้นกว่า 4 ตัวอักษร
const INSTITUTION_USERNAME_REGEX = /^[A-Za-z0-9_.-]{1,30}$/;

// ชื่อ/ตำแหน่ง: อนุญาตตัวอักษรไทย อังกฤษ ช่องว่าง และ .,-
const NAME_REGEX = /^[0-9A-Za-zก-๙\s.,-]{2,100}$/;

// pattern ที่มักใช้ทดสอบ SQL injection เช่น ' OR 1=1 --
const SUSPICIOUS_PATTERN = /(--|\bOR\b|\bAND\b|['"%*=;]|\/\*|\*\/)/i;

function expectedCoopGroup(memberGroup) {
  if (memberGroup === 'coop') return 'สหกรณ์';
  if (memberGroup === 'group') return 'กลุ่มเกษตรกร';
  return '';
}

function isMatchingInstitutionGroup(coop, memberGroup) {
  const expected = expectedCoopGroup(memberGroup);
  return Boolean(expected && coop && String(coop.coop_group || '').trim() === expected);
}

exports.form = (req, res) => {
  res.render('register', { error: null });
};

exports.checkInstitution = async (req, res) => {
  try {
    const mGroup = sanitizeText(req.query.m_group);
    const code = sanitizeText(req.query.username || req.query.c_code);

    if (!['coop', 'group'].includes(mGroup) || !code) {
      return res.status(400).json({ ok: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const coop = await activeCoopModel.getByCode(code);
    if (!isMatchingInstitutionGroup(coop, mGroup)) {
      return res.status(404).json({
        ok: false,
        message: mGroup === 'coop'
          ? 'ไม่พบรหัสสหกรณ์ในระบบ'
          : 'ไม่พบรหัสกลุ่มเกษตรกรในระบบ'
      });
    }

    res.json({
      ok: true,
      c_code: coop.c_code,
      c_name: coop.c_name
    });
  } catch (err) {
    console.error('Register institution check error:', err.message);
    res.status(500).json({ ok: false, message: 'ตรวจสอบข้อมูลไม่สำเร็จ' });
  }
};

exports.submit = async (req, res) => {
  try {
    const { username, fullname, position, email, password, confirm_password, m_group, m_type, m_class, hp_field } = req.body;

    // honeypot field: ถ้ามีค่าให้ถือว่าเป็นบอท ยิง spam -> ตัดทิ้งเงียบๆ
    if (hp_field && hp_field.toString().trim() !== '') {
      return res.status(400).send('ไม่สามารถสมัครสมาชิกได้');
    }

    const cleanUsername = sanitizeText(username);
    const cleanFullname = sanitizeText(fullname);
    const cleanPosition = sanitizeText(position);
    const cleanEmail = sanitizeText(email);

    if (!cleanUsername || !cleanPosition || !m_group || !m_type || !m_class || !password) {
      return res.status(400).send('กรอกข้อมูลให้ครบ');
    }
    if (password.length < 6) {
      return res.status(400).send('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
    }
    if (password !== confirm_password) {
      return res.status(400).send('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
    }

    // กัน payload ทดสอบ SQL injection ใน field หลักๆ
    if (SUSPICIOUS_PATTERN.test(cleanUsername) || SUSPICIOUS_PATTERN.test(cleanPosition)) {
      return res.status(400).send('ข้อมูลไม่ถูกต้อง');
    }

    if (!ALLOWED_MEMBER_GROUPS.includes(m_group)) {
      return res.status(400).send('กลุ่มผู้ใช้งานไม่ถูกต้อง');
    }

    let nameToUse = cleanFullname;
    let classToUse = m_class;
    let orgToUse = 'สำนักงานสหกรณ์จังหวัดชัยภูมิ';

    if (m_group === 'coop') {
      if (!INSTITUTION_USERNAME_REGEX.test(cleanUsername)) {
        return res.status(400).send('รหัสสหกรณ์ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _ . - จำนวน 1-30 ตัวอักษร');
      }
      if (!COOP_TYPES.includes(m_type)) {
        return res.status(400).send('ประเภทผู้ใช้ไม่ถูกต้อง');
      }
      const coop = await activeCoopModel.getByCode(cleanUsername);
      if (!isMatchingInstitutionGroup(coop, m_group)) {
        return res.status(400).send('ไม่พบรหัสสหกรณ์ในระบบ');
      }
      nameToUse = coop.c_name;
      classToUse = 'c';
      orgToUse = 'สหกรณ์และกลุ่มเกษตรกร';
    } else if (m_group === 'group') {
      if (!INSTITUTION_USERNAME_REGEX.test(cleanUsername)) {
        return res.status(400).send('รหัสกลุ่มเกษตรกรต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _ . - จำนวน 1-30 ตัวอักษร');
      }
      if (!FARMER_GROUP_TYPES.includes(m_type)) {
        return res.status(400).send('ประเภทผู้ใช้ไม่ถูกต้อง');
      }
      const coop = await activeCoopModel.getByCode(cleanUsername);
      if (!isMatchingInstitutionGroup(coop, m_group)) {
        return res.status(400).send('ไม่พบรหัสกลุ่มเกษตรกรในระบบ');
      }
      nameToUse = coop.c_name;
      classToUse = 'g';
      orgToUse = 'สหกรณ์และกลุ่มเกษตรกร';
    } else {
      if (!nameToUse) {
        return res.status(400).send('กรอกข้อมูลให้ครบ');
      }
      if (SUSPICIOUS_PATTERN.test(nameToUse)) {
        return res.status(400).send('ข้อมูลไม่ถูกต้อง');
      }
      // ตรวจรูปแบบชื่อ-นามสกุล / ตำแหน่ง แบบคร่าวๆ
      if (!NAME_REGEX.test(nameToUse) || !NAME_REGEX.test(cleanPosition)) {
        return res.status(400).send('รูปแบบชื่อหรือชื่อตำแหน่งไม่ถูกต้อง');
      }
      if (!CPD_TYPES.includes(m_type) || !ALLOWED_CPD_CLASSES.includes(m_class)) {
        return res.status(400).send('สังกัดหรือประเภทผู้ใช้ไม่ถูกต้อง');
      }
      if (!USERNAME_REGEX.test(cleanUsername)) {
        return res.status(400).send('ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _ . - จำนวน 3-30 ตัวอักษร');
      }
    }

    // ตรวจซ้ำ username
    const existed = await RegisterModel.findByUser(cleanUsername);
    if (existed) return res.status(409).send('ชื่อผู้ใช้นี้ถูกใช้แล้ว');

    // ตรวจ ENUM ของ m_type
    const typeToUse = ALLOWED_TYPES.includes(m_type) ? m_type : 'จ้างเหมาบริการ';

    const hash = await bcrypt.hash(password, 10);

    const userId = await RegisterModel.create({
      m_user: cleanUsername,
      m_pass: hash,
      m_group,
      m_name: nameToUse,
      m_position: cleanPosition,
      m_head: '',
      m_usersystem: cleanEmail || '',
      m_type: typeToUse,
      m_org: orgToUse,
      m_class: classToUse,
      m_pic: '',
      m_status: 'wait',
      m_img: ''
    });

    // Newly registered accounts require approval — do not auto-login.
    return res.redirect('/auth/login?registered=1');
  } catch (err) {
    console.error('Register error:', err.code, err.sqlMessage || err.message);
    if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.code === 'ER_WRONG_VALUE_FOR_FIELD') {
      return res.status(400).send('ค่าไม่ตรงตาม ENUM ของฐานข้อมูล');
    }
    res.status(500).send('สมัครสมาชิกไม่สำเร็จ');
  }
};
