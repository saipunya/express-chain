const db = require('../config/db');

exports.countAll = async (search = '') => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM vong_business
     WHERE vongb_code LIKE ? OR vongb_year LIKE ?`,
    [`%${search}%`, `%${search}%`]
  );
  return rows[0].total || 0;
};

exports.getPaged = async (search = '', page = 1, pageSize = 20) => {
  const offset = (page - 1) * pageSize;
  const [rows] = await db.query(
    `SELECT *
     FROM vong_business
     WHERE vongb_code LIKE ? OR vongb_year LIKE ?
     ORDER BY vongb_id DESC
     LIMIT ? OFFSET ?`,
    [`%${search}%`, `%${search}%`, Number(pageSize), Number(offset)]
  );
  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.query('SELECT * FROM vong_business WHERE vongb_id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const { vongb_code, vongb_year, vongb_money, vongb_date, vongb_filename, vongb_saveby, vongb_savedate } = data;
  const [result] = await db.query(
    `INSERT INTO vong_business
      (vongb_code, vongb_year, vongb_money, vongb_date, vongb_filename, vongb_saveby, vongb_savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [vongb_code, vongb_year, vongb_money, vongb_date, vongb_filename, vongb_saveby, vongb_savedate]
  );
  return result.insertId;
};

exports.update = async (id, data) => {
  const { vongb_code, vongb_year, vongb_money, vongb_date, vongb_filename, vongb_saveby, vongb_savedate } = data;
  await db.query(
    `UPDATE vong_business SET
      vongb_code = ?,
      vongb_year = ?,
      vongb_money = ?,
      vongb_date = ?,
      vongb_filename = ?,
      vongb_saveby = ?,
      vongb_savedate = ?
     WHERE vongb_id = ?`,
    [vongb_code, vongb_year, vongb_money, vongb_date, vongb_filename, vongb_saveby, vongb_savedate, id]
  );
};

exports.delete = async (id) => {
  await db.query('DELETE FROM vong_business WHERE vongb_id = ?', [id]);
};

exports.getLatest = async (limit = 10) => {
  const [rows] = await db.query(
    `SELECT *
     FROM vong_business
     ORDER BY vongb_id DESC
     LIMIT ?`,
    [Number(limit) || 10]
  );
  return rows;
};
