const db = require('../config/db');

const ITEMS_PER_PAGE = 30;

exports.countFinanceFiles = async (search = '') => {
  const [result] = await db.query(
    `SELECT COUNT(*) AS count FROM kb_finance WHERE c_name LIKE ?`,
    [`%${search}%`]
  );
  return result[0].count;
};

exports.getFinanceFiles = async (search = '', page = 1) => {
  const offset = (page - 1) * ITEMS_PER_PAGE;
  const [rows] = await db.query(
    `SELECT * FROM kb_finance WHERE c_name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [`%${search}%`, ITEMS_PER_PAGE, offset]
  );
  return rows;
};

exports.ITEMS_PER_PAGE = ITEMS_PER_PAGE;





exports.insertFile = async (data) => {
  const {
    c_code, c_name, end_year, file_name, link_file, saveby, savedate
  } = data;

  const [result] = await db.query(
    `INSERT INTO kb_finance (c_code, c_name, end_year, file_name, link_file, saveby, savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [c_code, c_name, end_year, file_name, link_file, saveby, savedate]
  );

  return result.insertId;
};

exports.getFiles = async (offset = 0, limit = 30) => {
  const [rows] = await db.query('SELECT * FROM kb_finance ORDER BY uploaded_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  return rows;
};

exports.countFiles = async () => {
  const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM kb_finance');
  return count;
};
// ใน models/financeModel.js
exports.getLastUploads = async (limit = 10) => {
  const [rows] = await db.query(`
    SELECT * FROM kb_finance
    ORDER BY savedate DESC
    LIMIT ?
  `, [limit]);
  return rows;
};




exports.getAllCoops = async () => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_status = "ดำเนินการ"');
  return rows;
};

exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query(
    'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ?',
    [group]
  );
  return rows;
};
