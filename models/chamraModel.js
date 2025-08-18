const db = require('../config/db');

const Chamra = {};

// ดึงข้อมูลทั้งหมด join ทุกตาราง
Chamra.getAll = async () => {
  const [rows] = await db.query(`
    SELECT a.*, d.*, p.*
    FROM active_coop a
    LEFT JOIN chamra_detail d ON a.c_code = d.de_code
    LEFT JOIN chamra_process p ON a.c_code = p.pr_code
  `);
  return rows;
};

// ดึงข้อมูลตาม c_code
Chamra.getByCode = async (c_code) => {
  const [rows] = await db.query(`
    SELECT a.*, d.*, p.*
    FROM active_coop a
    LEFT JOIN chamra_detail d ON a.c_code = d.de_code
    LEFT JOIN chamra_process p ON a.c_code = p.pr_code
    WHERE a.c_code = ?
  `, [c_code]);
  return rows[0];
};

// สร้าง record ใหม่
Chamra.create = async (data) => {
  await db.query('INSERT INTO active_coop SET ?', data.active);
  await db.query('INSERT INTO chamra_detail SET ?', data.detail);
  await db.query('INSERT INTO chamra_process SET ?', data.process);
};

// อัพเดต record
Chamra.update = async (c_code, data) => {
  await db.query('UPDATE active_coop SET ? WHERE c_code = ?', [data.active, c_code]);
  await db.query('UPDATE chamra_detail SET ? WHERE de_code = ?', [data.detail, c_code]);
  await db.query('UPDATE chamra_process SET ? WHERE pr_code = ?', [data.process, c_code]);
};

// ลบ record
Chamra.delete = async (c_code) => {
  await db.query('DELETE FROM chamra_process WHERE pr_code = ?', [c_code]);
  await db.query('DELETE FROM chamra_detail WHERE de_code = ?', [c_code]);
  await db.query('DELETE FROM active_coop WHERE c_code = ?', [c_code]);
};

module.exports = Chamra;
