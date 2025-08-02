const db = require('../config/db');

exports.listFiles = async () => {
  const [rows] = await db.query('SELECT * FROM kb_finance LEFT JOIN active_coop ON kb_finance.c_code = active_coop.c_code ORDER BY kb_finance.id DESC LIMIT 10');
  return rows;
};

exports.getFileById = async (id) => {
  const [rows] = await db.query('SELECT * FROM kb_finance WHERE id = ?', [id]);
  return rows[0];
};
