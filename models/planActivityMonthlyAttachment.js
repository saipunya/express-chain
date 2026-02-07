const db = require('../config/db');

module.exports = {
  async findByProjectAndMonth(proCode, reportMonth) {
    if (!proCode || !reportMonth) {
      return [];
    }
    const [rows] = await db.query(
      `SELECT id, pro_code, report_month, original_name, stored_name, mime_type, size, relative_path, uploaded_by, uploaded_at
       FROM plan_activity_monthly_attachment
       WHERE pro_code = ? AND report_month = ?
       ORDER BY uploaded_at DESC, id DESC`,
      [proCode, reportMonth]
    );
    return rows;
  },

  async findById(id) {
    if (!id) {
      return null;
    }
    const [[row]] = await db.query(
      `SELECT * FROM plan_activity_monthly_attachment WHERE id = ? LIMIT 1`,
      [id]
    );
    return row || null;
  },

  async create(payload) {
    const [result] = await db.query(
      `INSERT INTO plan_activity_monthly_attachment
       (pro_code, report_month, original_name, stored_name, mime_type, size, relative_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.pro_code,
        payload.report_month,
        payload.original_name,
        payload.stored_name,
        payload.mime_type,
        payload.size,
        payload.relative_path,
        payload.uploaded_by
      ]
    );
    return result.insertId;
  },

  async deleteById(id) {
    if (!id) {
      return 0;
    }
    const [result] = await db.query(
      `DELETE FROM plan_activity_monthly_attachment WHERE id = ?`,
      [id]
    );
    return result.affectedRows || 0;
  }
};
