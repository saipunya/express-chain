const db = require('../config/db');

exports.getAllFiles = async () => {
  const [rows] = await db.query('SELECT * FROM kb_finance ORDER BY id DESC');
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