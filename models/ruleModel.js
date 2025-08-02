const db = require('../config/db')

const ITEMS_PER_PAGE = 20;

exports.index = async (search = '', page = 1) => {
    const offset = (page - 1) * ITEMS_PER_PAGE;
    const [rows] = await db.query(
        `SELECT * FROM kt_rule WHERE rule_name LIKE ? ORDER BY rule_id DESC LIMIT ? OFFSET ?`,
        [`%${search}%`, ITEMS_PER_PAGE, offset]
    );
    return rows;
}

exports.countRules = async (search = '') => {
    const [result] = await db.query(
        `SELECT COUNT(*) AS count FROM kt_rule WHERE rule_name LIKE ?`,
        [`%${search}%`]
    );
    return result[0].count;
}

exports.detail = async (id) => {
    const [rows] = await db.query(`SELECT * FROM kt_rule WHERE rule_id = ?`, [id]);
    return rows[0];
}

exports.ITEMS_PER_PAGE = ITEMS_PER_PAGE;

exports.insertRule = async (data) => {
  const {
    rule_code, rule_name, rule_type, rule_year, er_no, rule_file, rule_saveby, rule_savedate
  } = data;

  const [result] = await db.query(
    `INSERT INTO kt_rule (rule_code, rule_name, rule_type, rule_year, er_no, rule_file, rule_saveby, rule_savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [rule_code, rule_name, rule_type, rule_year, er_no, rule_file, rule_saveby, rule_savedate]
  );

  return result.insertId;
};

exports.getLastUploads = async (limit = 10) => {
  const [rows] = await db.query(`
    SELECT rule_id, rule_name, rule_year, rule_type, er_no, rule_saveby, rule_savedate 
    FROM kt_rule 
    ORDER BY rule_id DESC
    LIMIT ?
  `, [limit]);
  return rows;
};
exports.coopAll = async () => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_status = "1"');
  return rows;
};

exports.getCoopByCode = async (code) => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_code = ?', [code]);
  return rows[0];
};
