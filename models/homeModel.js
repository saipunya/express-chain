const db = require('../config/db');

exports.getAllFiles = async () => {
  const [rows] = await db.query("SELECT kb_finance.id AS finance_id,kb_finance.c_name,kb_finance.c_code,active_coop.c_group,active_coop.coop_name,active_coop.end_year,active_coop.end_date FROM kb_finance LEFT JOIN active_coop ON kb_finance.c_code = active_coop.c_code ORDER BY kb_finance.id DESC");
  return rows;
};

exports.countFiles = async () => {
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM kb_finance');
  return rows[0].total;
};
exports.listFiles = async () => {
  try {
    const [rows] = await db.query('SELECT * FROM kb_finance ORDER BY id DESC LIMIT 10');
    return rows;
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
};
exports.showFiles = async () => {
  try {
    const [rows] = await db.query('SELECT * FROM kb_finance ORDER BY id DESC LIMIT 30');
    return rows;
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
};
exports.getFileById = async (id) => {
    const [rows] = await db.query('SELECT * FROM kb_finance WHERE id = ?', [id]);
    return rows[0];
  };