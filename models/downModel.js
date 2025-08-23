const db = require('../config/db');

exports.getAll = async () => {
  const [rows] = await db.query('SELECT * FROM download ORDER BY down_savedate DESC');
  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.query('SELECT * FROM download WHERE down_id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const [result] = await db.query(
    `INSERT INTO download (down_subject, down_group, down_type, down_for, down_file, down_link, down_saveby, down_savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.down_subject, data.down_group, data.down_type, data.down_for, data.down_file, data.down_link, data.down_saveby, data.down_savedate]
  );
  return result.insertId;
};

exports.update = async (id, data) => {
  await db.query(
    `UPDATE download SET down_subject=?, down_group=?, down_type=?, down_for=?, down_file=?, down_link=?, down_saveby=?, down_savedate=?
     WHERE down_id=?`,
    [data.down_subject, data.down_group, data.down_type, data.down_for, data.down_file, data.down_link, data.down_saveby, data.down_savedate, id]
  );
};

exports.delete = async (id) => {
  await db.query('DELETE FROM download WHERE down_id = ?', [id]);
};

exports.searchBySubject = async (search) => {
  if (!search) {
    const [rows] = await db.query('SELECT * FROM download ORDER BY down_savedate DESC');
    return rows;
  }
  const [rows] = await db.query(
    'SELECT * FROM download WHERE down_subject LIKE ? ORDER BY down_savedate DESC',
    [`%${search}%`]
  );
  return rows;
};