const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { LearningError } = require('./learningService');

const usernamePattern = /^[a-z0-9._-]{3,60}$/;
const dummyHash = bcrypt.hashSync('learning-sign-in-placeholder', 12);

async function listCooperatives() {
  const [rows] = await db.execute(`SELECT c_id, c_name FROM active_coop
    WHERE c_status = 'ดำเนินการ' AND coop_group = 'สหกรณ์' ORDER BY c_name, c_id`);
  return rows;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function register(body) {
  const fullname = text(body.fullname).replace(/\s+/g, ' ');
  const username = text(body.username).toLowerCase();
  const password = body.password;
  const cooperativeId = text(body.cooperativeId);
  const memberNumber = text(body.memberNumber).replace(/\s+/g, ' ').toUpperCase();
  if (!fullname || fullname.length > 150 || !/^[1-9]\d{0,14}$/.test(cooperativeId)
    || !/^[\p{L}\p{N}][\p{L}\p{N} ./-]{0,49}$/u.test(memberNumber)) {
    throw new LearningError(400, 'กรุณาระบุชื่อ สหกรณ์ และเลขสมาชิกให้ถูกต้อง');
  }
  if (!usernamePattern.test(username)) {
    throw new LearningError(400, 'ชื่อผู้ใช้ต้องมี 3–60 ตัว ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข จุด ขีด และขีดล่างได้');
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72 || password !== body.confirmPassword) {
    throw new LearningError(400, 'ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษรและกรอกรหัสผ่านยืนยันให้ตรงกัน');
  }
  const [[cooperative]] = await db.execute(`SELECT c_id, c_name FROM active_coop
    WHERE c_id = ? AND c_status = 'ดำเนินการ' AND coop_group = 'สหกรณ์' LIMIT 1`, [cooperativeId]);
  if (!cooperative) throw new LearningError(400, 'กรุณาเลือกสหกรณ์จากทะเบียนในจังหวัดชัยภูมิ');
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute(`INSERT INTO learning_learners (username, password_hash, full_name,
      cooperative_id, cooperative_name, member_number) VALUES (?, ?, ?, ?, ?, ?)`,
    [username, passwordHash, fullname, cooperative.c_id, cooperative.c_name, memberNumber]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new LearningError(409, 'ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่อผู้ใช้อื่น');
    throw error;
  }
}

async function login(body) {
  const username = text(body.username).toLowerCase();
  const password = typeof body.password === 'string' && Buffer.byteLength(body.password) <= 72 ? body.password : '';
  const [[learner]] = await db.execute(`SELECT id, username, password_hash, full_name, status
    FROM learning_learners WHERE username = ? LIMIT 1`, [usernamePattern.test(username) ? username : '']);
  if (!(await bcrypt.compare(password, learner?.password_hash || dummyHash)) || !learner) {
    throw new LearningError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (learner.status === 'pending') throw new LearningError(403, 'บัญชีอยู่ระหว่างตรวจสอบ กรุณารอเจ้าหน้าที่อนุมัติ');
  if (learner.status === 'rejected') throw new LearningError(403, 'บัญชียังไม่ได้รับอนุมัติ กรุณาติดต่อสำนักงานสหกรณ์จังหวัดชัยภูมิ');
  return { id: learner.id, username: learner.username, fullname: learner.full_name, kind: 'learner' };
}

async function listPending() {
  const [rows] = await db.execute(`SELECT id, full_name, username, cooperative_name, member_number
    FROM learning_learners WHERE status = 'pending' ORDER BY id LIMIT 100`);
  return rows;
}

async function review(id, action, reviewerId) {
  if (!/^[1-9]\d{0,14}$/.test(id) || !['approve', 'reject'].includes(action)) {
    throw new LearningError(400, 'กรุณาเลือกรายการสมัครและผลการตรวจสอบ');
  }
  const approving = action === 'approve';
  try {
    const [result] = await db.execute(`UPDATE learning_learners SET status = ?,
      approved_member_number = CASE WHEN ? THEN member_number ELSE NULL END,
      reviewed_by = ?, reviewed_at = NOW() WHERE id = ? AND status = 'pending'`,
    [approving ? 'active' : 'rejected', approving, reviewerId, id]);
    if (!result.affectedRows) throw new LearningError(409, 'คำขอนี้ได้รับการตรวจสอบแล้ว');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new LearningError(409, 'สหกรณ์นี้มีบัญชีที่ได้รับอนุมัติสำหรับเลขสมาชิกดังกล่าวแล้ว');
    throw error;
  }
}

module.exports = { listCooperatives, register, login, listPending, review };
