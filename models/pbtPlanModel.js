const db = require('../config/db');

const TABLE = 'pbt_plan';

const toDateString = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return text.includes('T') ? text.slice(0, 10) : text;
};

const normalizeRow = (data = {}) => ({
  p_plan: (data.p_plan ?? '').toString().trim(),
  p_month: (data.p_month ?? '').toString().trim(),
  p_year: (data.p_year ?? '').toString().trim(),
  p_code: (data.p_code ?? '').toString().trim(),
  p_project: (data.p_project ?? '').toString().trim(),
  p_img: (data.p_img ?? '').toString().trim(),
  p_saveby: (data.p_saveby ?? '').toString().trim(),
  p_savedate: toDateString(data.p_savedate)
});

const PbtPlan = {
  getAll: async () => {
    const [rows] = await db.query(
      `SELECT *
       FROM ${TABLE}
       ORDER BY p_year DESC, p_month DESC, p_plan ASC, p_code ASC, p_id DESC`
    );
    return rows;
  },

  getById: async (id) => {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE p_id = ?`, [id]);
    return rows[0];
  },

  getByPeriod: async (p_year, p_month) => {
    const [rows] = await db.query(
      `SELECT *
       FROM ${TABLE}
       WHERE p_year = ? AND p_month = ?`,
      [String(p_year ?? '').trim(), String(p_month ?? '').trim()]
    );
    return rows;
  },

  create: async (data) => {
    const row = normalizeRow(data);
    const [result] = await db.query(
      `INSERT INTO ${TABLE} (p_plan, p_month, p_year, p_code, p_project, p_img, p_saveby, p_savedate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.p_plan, row.p_month, row.p_year, row.p_code, row.p_project, row.p_img, row.p_saveby, row.p_savedate]
    );
    return result.insertId;
  },

  createMany: async (items = []) => {
    const rows = Array.isArray(items) ? items.map(normalizeRow) : [];
    if (!rows.length) return [];

    const placeholders = rows.map(() => '(?,?,?,?,?,?,?,?)').join(', ');
    const params = rows.flatMap((row) => [
      row.p_plan,
      row.p_month,
      row.p_year,
      row.p_code,
      row.p_project,
      row.p_img,
      row.p_saveby,
      row.p_savedate
    ]);

    const [result] = await db.query(
      `INSERT INTO ${TABLE} (p_plan, p_month, p_year, p_code, p_project, p_img, p_saveby, p_savedate)
       VALUES ${placeholders}`,
      params
    );

    return result;
  },

  update: async (id, data) => {
    const row = normalizeRow(data);
    await db.query(
      `UPDATE ${TABLE}
       SET p_plan = ?, p_month = ?, p_year = ?, p_code = ?, p_project = ?, p_img = ?, p_saveby = ?, p_savedate = ?
       WHERE p_id = ?`,
      [row.p_plan, row.p_month, row.p_year, row.p_code, row.p_project, row.p_img, row.p_saveby, row.p_savedate, id]
    );
  },

  delete: async (id) => {
    await db.query(`DELETE FROM ${TABLE} WHERE p_id = ?`, [id]);
  }
};

module.exports = PbtPlan;
