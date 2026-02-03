const db = require('../config/db');

exports.getAll = async () => {
  const [rows] = await db.query('SELECT * FROM plan_main ORDER BY ma_id DESC');
  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.query('SELECT * FROM plan_main WHERE ma_id = ?', [id]);
  return rows[0];
};

exports.getByCode = async (code) => {
  const [rows] = await db.query('SELECT * FROM plan_main WHERE ma_code = ?', [code]);
  return rows[0];
};

exports.create = async (data) => {
  const { ma_code, ma_subject, ma_detail, ma_saveby, ma_savedate } = data;
  const [result] = await db.query(
    `INSERT INTO plan_main (ma_code, ma_subject, ma_detail, ma_saveby, ma_savedate)
     VALUES (?, ?, ?, ?, ?)`,
    [ma_code, ma_subject, ma_detail, ma_saveby, ma_savedate]
  );
  return result.insertId;
};

exports.update = async (id, data) => {
  const { ma_code, ma_subject, ma_detail, ma_saveby, ma_savedate } = data;
  const [result] = await db.query(
    `UPDATE plan_main
     SET ma_code = ?, ma_subject = ?, ma_detail = ?, ma_saveby = ?, ma_savedate = ?
     WHERE ma_id = ?`,
    [ma_code, ma_subject, ma_detail, ma_saveby, ma_savedate, id]
  );
  return result;
};

exports.delete = async (id) => {
  const [result] = await db.query('DELETE FROM plan_main WHERE ma_id = ?', [id]);
  return result;
};
