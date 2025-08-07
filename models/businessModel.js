const db = require('../config/db');

const ITEMS_PER_PAGE = 30;

exports.insertBusiness = async (data) => {
  const { bu_code, bu_name, bu_endyear, bu_filename, bu_saveby, bu_savedate } = data;
  const [result] = await db.query(
    `INSERT INTO kb_allbusiness (bu_code, bu_name, bu_endyear, bu_filename, bu_saveby, bu_savedate)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [bu_code, bu_name, bu_endyear, bu_filename, bu_saveby, bu_savedate]
  );
  return result.insertId;
};

exports.getBusinessFiles = async (search = '', page = 1) => {
  const offset = (page - 1) * ITEMS_PER_PAGE;
  const [rows] = await db.query(
    `SELECT kb_allbusiness.*, active_coop.c_name, active_coop.end_date 
     FROM kb_allbusiness 
     LEFT JOIN active_coop ON kb_allbusiness.bu_code = active_coop.c_code
     WHERE kb_allbusiness.bu_name LIKE ? 
     ORDER BY kb_allbusiness.bu_id DESC 
     LIMIT ? OFFSET ?`,
    [`%${search}%`, ITEMS_PER_PAGE, offset]
  );
  return rows;
};

exports.countBusinessFiles = async (search = '') => {
  const [result] = await db.query(
    `SELECT COUNT(*) AS count FROM kb_allbusiness WHERE bu_name LIKE ?`,
    [`%${search}%`]
  );
  return result[0].count;
};

exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query(
    'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ?',
    [group]
  );
  return rows;
};

exports.getBusinessById = async (id) => {
  const [rows] = await db.query('SELECT * FROM kb_allbusiness WHERE bu_id = ?', [id]);
  return rows[0];
};

exports.deleteBusiness = async (id) => {
  const [rows] = await db.query('DELETE FROM kb_allbusiness WHERE bu_id = ?', [id]);
  return rows;
};

exports.getLastUploads = async (limit = 10) => {
  const [rows] = await db.query(`
    SELECT kb_allbusiness.*, active_coop.c_name, active_coop.end_date 
    FROM kb_allbusiness
    LEFT JOIN active_coop ON kb_allbusiness.bu_code = active_coop.c_code 
    ORDER BY kb_allbusiness.bu_id DESC
    LIMIT ?
  `, [limit]);
  return rows;
};

exports.ITEMS_PER_PAGE = ITEMS_PER_PAGE;