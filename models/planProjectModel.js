const db = require('../config/db');

exports.getAll = async () => {
  const [rows] = await db.query('SELECT * FROM plan_project ORDER BY pro_id DESC');
  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.query('SELECT * FROM plan_project WHERE pro_id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const {
    pro_code, pro_subject, pro_target, pro_budget, pro_group,
    pro_respon, pro_saveby, pro_savedate, pro_macode
  } = data;
  const [result] = await db.query(
    `INSERT INTO plan_project
      (pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_saveby, pro_savedate, pro_macode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_saveby, pro_savedate, pro_macode]
  );
  return result.insertId;
};

exports.update = async (id, data) => {
  const {
    pro_code, pro_subject, pro_target, pro_budget, pro_group,
    pro_respon, pro_saveby, pro_savedate, pro_macode
  } = data;
  const [result] = await db.query(
    `UPDATE plan_project SET
      pro_code = ?, pro_subject = ?, pro_target = ?, pro_budget = ?, pro_group = ?,
      pro_respon = ?, pro_saveby = ?, pro_savedate = ?, pro_macode = ?
     WHERE pro_id = ?`,
    [pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_saveby, pro_savedate, pro_macode, id]
  );
  return result;
};

exports.delete = async (id) => {
  const [result] = await db.query('DELETE FROM plan_project WHERE pro_id = ?', [id]);
  return result;
};
