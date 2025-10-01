const db = require('../config/db');

exports.getAll = async () => {
  const [rows] = await db.query(`
    SELECT vong_coop.*, active_coop.c_name, active_coop.c_group,active_coop.c_code,active_coop.end_date
    FROM vong_coop 
    LEFT JOIN active_coop ON vong_coop.vong_code = active_coop.c_code 
    ORDER BY vong_coop.vong_id DESC
  `);
  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.query(`
    SELECT vong_coop.*, active_coop.c_name, active_coop.c_group,active_coop.c_code 
    FROM vong_coop 
    LEFT JOIN active_coop ON vong_coop.vong_code = active_coop.c_code 
    WHERE vong_coop.vong_id = ?
  `, [id]);
  return rows[0];
};

exports.search = async (searchTerm) => {
  const [rows] = await db.query(`
    SELECT vong_coop.*, active_coop.c_name, active_coop.c_group,active_coop.c_code 
    FROM vong_coop 
    LEFT JOIN active_coop ON vong_coop.vong_code = active_coop.c_code 
    WHERE active_coop.c_name LIKE ? OR vong_coop.vong_year LIKE ?
    ORDER BY vong_coop.vong_year DESC
  `, [`%${searchTerm}%`, `%${searchTerm}%`]);
  return rows;
};

exports.create = async (data) => {
  const { vong_code, vong_year, vong_money, vong_date, vong_filename, vong_saveby, vong_savedate } = data;
  const [result] = await db.query(
    `INSERT INTO vong_coop 
    (vong_code, vong_year, vong_money, vong_date, vong_filename, vong_saveby, vong_savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,

    [vong_code, vong_year, vong_money, vong_date, vong_filename, vong_saveby, vong_savedate]
  );
  return result.insertId;
};

exports.update = async (id, data) => {
  const { vong_code, vong_year, vong_money, vong_date, vong_filename, vong_saveby, vong_savedate } = data;
  await db.query(
    `UPDATE vong_coop SET 
     vong_code = ?, vong_year = ?, vong_money = ?, vong_date = ?, 
     vong_filename = ?, vong_saveby = ?, vong_savedate = ? 
     WHERE vong_id = ?`,
    [vong_code, vong_year, vong_money, vong_date, vong_filename, vong_saveby, vong_savedate, id]
  );
};

exports.delete = async (id) => {
  await db.query('DELETE FROM vong_coop WHERE vong_id = ?', [id]);
};

// สกัดสหกรณ์ตามกลุ่ม (เก็บเวอร์ชันเดียว)
exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query(
    'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ? ORDER BY c_name',
    [group]
  );
  return rows;
};

// NEW: ล่าสุดตามจำนวน limit
exports.getLatest = async (limit = 10) => {
  const [rows] = await db.query(
    `SELECT vong_coop.vong_id,
            vong_coop.vong_code,
            vong_coop.vong_year,
            vong_coop.vong_money,
            vong_coop.vong_date,
            vong_coop.vong_filename,
            active_coop.c_name,
            active_coop.end_date
     FROM vong_coop
     LEFT JOIN active_coop ON vong_coop.vong_code = active_coop.c_code
     ORDER BY vong_coop.vong_id DESC
     LIMIT ?`,
    [Number(limit) || 10]
  );
  return rows;
};

// NEW: count all rows for pagination
exports.countAll = async () => {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM vong_coop');
  return rows[0].total;
};

// NEW: paged fetch with join ordering by id desc
exports.getPaged = async (page = 1, pageSize = 20) => {
  const offset = (page - 1) * pageSize;
  const [rows] = await db.query(`
    SELECT vong_coop.*, active_coop.c_name, active_coop.c_group, active_coop.c_code, active_coop.end_date
    FROM vong_coop
    LEFT JOIN active_coop ON vong_coop.vong_code = active_coop.c_code
    ORDER BY vong_coop.vong_id DESC
    LIMIT ? OFFSET ?
  `, [Number(pageSize), Number(offset)]);
  return rows;
};
