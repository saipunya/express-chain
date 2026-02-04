const db = require('../config/db');

// ดึงข้อมูลทั้งหมด
exports.findAll = async () => {
  const [rows] = await db.query('SELECT * FROM add_mem ORDER BY addmem_id DESC');
  return rows;
};

// ดึงข้อมูลตาม ID
exports.findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM add_mem WHERE addmem_id = ?', [id]);
  return rows[0];
};

// ดึงข้อมูลแบบแบ่งหน้า
exports.findPage = async (limit, offset) => {
  const [rows] = await db.query(
    'SELECT * FROM add_mem ORDER BY addmem_id DESC LIMIT ? OFFSET ?',
    [Number(limit), Number(offset)]
  );
  return rows;
};

// นับข้อมูลทั้งหมด
exports.countAll = async () => {
  const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM add_mem');
  return rows[0].cnt;
};

// ค้นหาตามรหัส
exports.findByCode = async (code) => {
  const [rows] = await db.query('SELECT * FROM add_mem WHERE addmem_code = ?', [code]);
  return rows[0];
};

// เพิ่มข้อมูล
exports.insert = async (data) => {
  const sql = `INSERT INTO add_mem (
    addmem_code, addmem_year, addmem_saman, addmem_somtob, 
    addmem_saveby, addmem_savedate
  ) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = Object.values(data);
  await db.query(sql, params);
  return params;
};

// อัปเดตข้อมูล
exports.update = async (id, data) => {
  const sql = `UPDATE add_mem SET
    addmem_code = ?, addmem_year = ?, addmem_saman = ?, addmem_somtob = ?,
    addmem_saveby = ?, addmem_savedate = ?
    WHERE addmem_id = ?`;
  const params = [...Object.values(data), id];
  await db.query(sql, params);
  return params;
};

// ลบข้อมูล
exports.delete = async (id) => {
  await db.query('DELETE FROM add_mem WHERE addmem_id = ?', [id]);
};

// ดึงข้อมูลล่าสุด N รายการ
exports.findRecent = async (limit = 5) => {
  const [rows] = await db.query(
    'SELECT * FROM add_mem ORDER BY addmem_id DESC LIMIT ?',
    [Number(limit)]
  );
  return rows;
};

// ตรวจสอบว่ารหัสซ้ำหรือไม่
exports.isCodeDuplicate = async (code, excludeId = null) => {
  let sql = 'SELECT COUNT(*) AS count FROM add_mem WHERE addmem_code = ?';
  let params = [code];
  
  if (excludeId) {
    sql += ' AND addmem_id != ?';
    params.push(excludeId);
  }
  
  const [rows] = await db.query(sql, params);
  return rows[0].count > 0;
};
