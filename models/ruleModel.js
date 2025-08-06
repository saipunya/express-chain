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
    SELECT kt_rule.rule_id, kt_rule.rule_name, kt_rule.rule_year, kt_rule.rule_type, kt_rule.er_no, kt_rule.rule_saveby, kt_rule.rule_savedate ,active_coop.c_name,active_coop.c_group,active_coop.c_code,active_coop.end_date
    FROM kt_rule LEFT JOIN active_coop ON kt_rule.rule_code = active_coop.c_code
    ORDER BY kt_rule.rule_id DESC
    LIMIT ?
  `, [limit]);
  return rows;
};
exports.coopAll = async () => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_status = "ดำเนินการ"');
  return rows;
};

exports.getCoopByCode = async (code) => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_code = ?', [code]);
  return rows[0];
};

exports.deleteRule = async (id) => {
  const [rows] = await db.query('DELETE FROM kt_rule WHERE rule_id = ?', [id]);
  return rows;
  
};


exports.getFilenameById = async (id) => {
  const [rows] = await db.query('SELECT rule_file FROM kt_rule WHERE rule_id = ?', [id]);
  return rows[0].rule_file;
};

exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query(
    'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ? ORDER BY c_name',
    [group]
  );
  return rows;
};
