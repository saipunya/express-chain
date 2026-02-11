const db = require('../config/db');

// ดึงข้อมูลทั้งหมด
exports.findAll = async () => {
  const [rows] = await db.query('SELECT * FROM addmem ORDER BY addmem_id DESC');
  return rows;
};

// ดึงข้อมูลตาม ID
exports.findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM addmem WHERE addmem_id = ?', [id]);
  return rows[0];
};

// ดึงข้อมูลแบบแบ่งหน้า
exports.findPage = async (limit, offset) => {
  const [rows] = await db.query(
    'SELECT * FROM addmem ORDER BY addmem_id DESC LIMIT ? OFFSET ?',
    [Number(limit), Number(offset)]
  );
  return rows;
};

// นับข้อมูลทั้งหมด
exports.countAll = async () => {
  const [rows] = await db.query('SELECT COUNT(*) AS cnt FROM addmem');
  return rows[0].cnt;
};

// ค้นหาตามรหัส
exports.findByCode = async (code) => {
  const [rows] = await db.query('SELECT * FROM addmem WHERE addmem_code = ?', [code]);
  return rows[0];
};

// เพิ่มข้อมูล
exports.insert = async (data) => {
  const sql = `INSERT INTO addmem (
    addmem_code, addmem_year, addmem_saman, addmem_somtob, 
    addmem_saveby, addmem_savedate
  ) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = Object.values(data);
  await db.query(sql, params);
  return params;
};

// อัปเดตข้อมูล
exports.update = async (id, data) => {
  const sql = `UPDATE addmem SET
    addmem_code = ?, addmem_year = ?, addmem_saman = ?, addmem_somtob = ?,
    addmem_saveby = ?, addmem_savedate = ?
    WHERE addmem_id = ?`;
  const params = [...Object.values(data), id];
  await db.query(sql, params);
  return params;
};

// ลบข้อมูล
exports.delete = async (id) => {
  await db.query('DELETE FROM addmem WHERE addmem_id = ?', [id]);
};

// ดึงข้อมูลล่าสุด N รายการ
exports.findRecent = async (limit = 5) => {
  const [rows] = await db.query(
    'SELECT * FROM addmem ORDER BY addmem_id DESC LIMIT ?',
    [Number(limit)]
  );
  return rows;
};

// ตรวจสอบว่ารหัสซ้ำหรือไม่
exports.isCodeDuplicate = async (code, excludeId = null) => {
  let sql = 'SELECT COUNT(*) AS count FROM addmem WHERE addmem_code = ?';
  let params = [code];
  
  if (excludeId) {
    sql += ' AND addmem_id != ?';
    params.push(excludeId);
  }
  
  const [rows] = await db.query(sql, params);
  return rows[0].count > 0;
};

// ดึงข้อมูล addmem ตาม c_code พร้อม join active_coop และคำนวณ end_date + addmem_year
exports.getByCoopCode = async (coopCode) => {
  const sql = `
    SELECT 
      am.addmem_id,
      am.addmem_code,
      am.addmem_year,
      am.addmem_saman,
      am.addmem_somtob,
      am.addmem_saveby,
      am.addmem_savedate,
      ac.end_date,
      DATE_ADD(ac.end_date, INTERVAL CAST(am.addmem_year AS SIGNED) YEAR) AS calculated_date
    FROM addmem am
    LEFT JOIN active_coop ac ON am.addmem_code = ac.c_code
    WHERE am.addmem_code = ?
    ORDER BY CAST(am.addmem_year AS SIGNED) DESC
  `;
  const [rows] = await db.query(sql, [coopCode]);
  return rows;
};
