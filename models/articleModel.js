const db = require('../config/db');


exports.getAll = async () => {
  const [rows] = await db.query('SELECT * FROM tbl_article ORDER BY ar_savedate DESC');
  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.query('SELECT * FROM tbl_article WHERE ar_id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const [result] = await db.query(
    `INSERT INTO tbl_article (ar_subject, ar_detail, ar_link, ar_keyword, ar_img, ar_saveby, ar_savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.ar_subject, data.ar_detail, data.ar_link, data.ar_keyword, JSON.stringify(data.ar_img), data.ar_saveby, data.ar_savedate]
  );
  return result.insertId;
};

exports.update = async (id, data) => {
  await db.query(
    `UPDATE tbl_article SET ar_subject=?, ar_detail=?, ar_link=?, ar_keyword=?, ar_img=?, ar_saveby=?, ar_savedate=?
     WHERE ar_id=?`,
    [data.ar_subject, data.ar_detail, data.ar_link, data.ar_keyword, JSON.stringify(data.ar_img), data.ar_saveby, data.ar_savedate, id]
  );
};

exports.delete = async (id) => {
  await db.query('DELETE FROM tbl_article WHERE ar_id = ?', [id]);
};

exports.getLast = async (limit = 4) => {
  limit = parseInt(limit, 10); // ป้องกัน SQL injection
  const [rows] = await db.query(`SELECT * FROM tbl_article ORDER BY ar_savedate DESC LIMIT ${limit}`);
  return rows;
};