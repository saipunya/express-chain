const db = require('../config/db');

exports.listFiles = async () => {
  const [rows] = await db.query('SELECT * FROM kb_finance ORDER BY id DESC LIMIT 10');
  return rows;
};

exports.getFileById = async (id) => {
  const [rows] = await db.query('SELECT * FROM kb_finance WHERE id = ?', [id]);
  return rows[0];
};
