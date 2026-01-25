const db = require('../config/db');

exports.getAll = async (filters = {}) => {
  const { pro_respon_id } = filters || {};

  const where = [];
  const params = [];

  if (pro_respon_id !== undefined && pro_respon_id !== null && String(pro_respon_id) !== '') {
    where.push('p.pro_respon_id = ?');
    params.push(pro_respon_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await db.query(
      `SELECT
        p.*,
        u.m_user AS respon_username,
        u.m_name AS respon_name,
        u.m_position AS respon_position,
        u.m_class AS respon_class
      FROM plan_project p
      LEFT JOIN member3 u ON u.m_id = p.pro_respon_id
      ${whereSql}
      ORDER BY p.pro_id DESC`,
      params
    );
    return rows;
  } catch (e) {
    // Backward compatibility if DB is not migrated yet
    if (String(e && e.code) === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await db.query('SELECT * FROM plan_project ORDER BY pro_id DESC');
      return rows;
    }
    throw e;
  }
};

exports.getById = async (id) => {
  try {
    const [rows] = await db.query(
      `SELECT
        p.*,
        u.m_user AS respon_username,
        u.m_name AS respon_name,
        u.m_position AS respon_position,
        u.m_class AS respon_class
      FROM plan_project p
      LEFT JOIN member3 u ON u.m_id = p.pro_respon_id
      WHERE p.pro_id = ?`,
      [id]
    );
    return rows[0];
  } catch (e) {
    // Backward compatibility if DB is not migrated yet
    if (String(e && e.code) === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await db.query('SELECT * FROM plan_project WHERE pro_id = ?', [id]);
      return rows[0];
    }
    throw e;
  }
};

exports.create = async (data) => {
  const {
    pro_code, pro_subject, pro_target, pro_budget, pro_group,
    pro_respon, pro_respon_id, pro_saveby, pro_savedate, pro_macode, pro_status
  } = data;
  try {
    const [result] = await db.query(
      `INSERT INTO plan_project
        (pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_respon_id, pro_saveby, pro_savedate, pro_macode, pro_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_respon_id ?? null, pro_saveby, pro_savedate, pro_macode, pro_status]
    );
    return result.insertId;
  } catch (e) {
    // Backward compatibility if DB is not migrated yet
    if (String(e && e.code) === 'ER_BAD_FIELD_ERROR') {
      const [result] = await db.query(
        `INSERT INTO plan_project
          (pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_saveby, pro_savedate, pro_macode, pro_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_saveby, pro_savedate, pro_macode, pro_status]
      );
      return result.insertId;
    }
    throw e;
  }
};

exports.update = async (id, data) => {
  const {
    pro_code, pro_subject, pro_target, pro_budget, pro_group,
    pro_respon, pro_respon_id, pro_saveby, pro_savedate, pro_macode, pro_status
  } = data;
  try {
    const [result] = await db.query(
      `UPDATE plan_project SET
        pro_code = ?, pro_subject = ?, pro_target = ?, pro_budget = ?, pro_group = ?,
        pro_respon = ?, pro_respon_id = ?, pro_saveby = ?, pro_savedate = ?, pro_macode = ?, pro_status = ?
       WHERE pro_id = ?`,
      [pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_respon_id ?? null, pro_saveby, pro_savedate, pro_macode, pro_status, id]
    );
    return result;
  } catch (e) {
    // Backward compatibility if DB is not migrated yet
    if (String(e && e.code) === 'ER_BAD_FIELD_ERROR') {
      const [result] = await db.query(
        `UPDATE plan_project SET
          pro_code = ?, pro_subject = ?, pro_target = ?, pro_budget = ?, pro_group = ?,
          pro_respon = ?, pro_saveby = ?, pro_savedate = ?, pro_macode = ?, pro_status = ?
         WHERE pro_id = ?`,
        [pro_code, pro_subject, pro_target, pro_budget, pro_group, pro_respon, pro_saveby, pro_savedate, pro_macode, pro_status, id]
      );
      return result;
    }
    throw e;
  }
};

exports.delete = async (id) => {
  const [result] = await db.query('DELETE FROM plan_project WHERE pro_id = ?', [id]);
  return result;
};
