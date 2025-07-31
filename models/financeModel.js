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
