const db = require('../config/db');

exports.getAll = async () => {
  const [rows] = await db.query(`
    SELECT vong_coop.*, active_coop.c_name, active_coop.c_group,active_coop.c_code,active_coop.end_date
    FROM vong_coop 
    LEFT JOIN active_coop ON vong_coop.vong_code = active_coop.c_code 
    ORDER BY vong_coop.vong_year DESC
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

// สร้าง function สำหรับการสกัดสหกรณ์ตามกลุ่ม
exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query(
    'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ? ORDER BY c_name',
    [group]
  );
  return rows;
};

exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query(
    'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ?',
    [group]
  );
  return rows;
};
