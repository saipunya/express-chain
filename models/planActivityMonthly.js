const db = require('../config/db');

module.exports = {
  async findByActivitiesAndMonth(activityIds, reportMonth) {
    if (!Array.isArray(activityIds) || activityIds.length === 0) {
      return [];
    }

    const placeholders = activityIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT *
       FROM plan_activity_monthly
       WHERE ac_id IN (${placeholders}) AND report_month = ?
       ORDER BY updated_at DESC, id DESC`,
      [...activityIds, reportMonth]
    );
    return rows;
  },

  async upsertStatuses(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return 0;
    }

    const placeholders = rows.map(() => '(?, ?, ?, ?, ?)').join(',');
    const values = [];

    rows.forEach((row) => {
      values.push(row.ac_id, row.report_month, row.status, row.note || null, row.updated_by || null);
    });

    const [result] = await db.query(
      `INSERT INTO plan_activity_monthly (ac_id, report_month, status, note, updated_by)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         note = VALUES(note),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      values
    );

    return result.affectedRows || 0;
  }
};
