const db = require('../config/db');

class PlanActivityMonthly {
  /**
   * Find records by activity IDs and report month
   * @param {Array} activityIds - Array of activity IDs
   * @param {string} reportMonth - Report month
   * @returns {Promise<Array>}
   */
  static async findByActivitiesAndMonth(activityIds, reportMonth) {
    if (!Array.isArray(activityIds) || activityIds.length === 0) {
      return [];
    }

    const placeholders = activityIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT *
       FROM activity_monthly
       WHERE ac_id IN (${placeholders}) AND report_month = ?
       ORDER BY updated_at DESC, id DESC`,
      [...activityIds, reportMonth]
    );
    return rows;
  }

  /**
   * Upsert statuses for activity monthly records
   * @param {Array} rows - Array of rows to upsert
   * @returns {Promise<number>}
   */
  static async upsertStatuses(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return 0;
    }

    // ✅ 6 placeholders: ac_id, pro_code, report_month, status, note, updated_by
    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
    const values = [];

    rows.forEach((row) => {
      values.push(
        row.ac_id,
        row.pro_code,
        row.report_month,
        row.status,
        row.note || null,
        row.updated_by || null
      );
    });

    const [result] = await db.query(
      `INSERT INTO activity_monthly (ac_id, pro_code, report_month, status, note, updated_by)
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

  /**
   * Get historical monthly records for a project (last N months)
   * @param {string} proCode - Project code
   * @param {number} months - Number of months to fetch (default 12)
   * @returns {Promise<Array>}
   */
  static async getHistoricalByProject(proCode, months = 12) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE_FORMAT(am.report_month, '%Y-%m') AS report_month,
          am.report_month as report_month_full,
          COUNT(am.ac_id) as total_activities,
          SUM(CASE WHEN am.status = 2 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN am.status = 1 THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN am.status = 0 OR am.status IS NULL THEN 1 ELSE 0 END) as not_started
        FROM activity_monthly am
        WHERE am.pro_code = ?
        GROUP BY DATE_FORMAT(am.report_month, '%Y-%m'), am.report_month
        ORDER BY am.report_month DESC
        LIMIT ?
      `;

      // Check if db.query returns Promise (async) or uses callback
      if (db.query.length > 2) {
        // Callback-based db
        db.query(query, [proCode, months], (err, results) => {
          if (err) {
            console.error('DB Query Error:', err);
            return reject(err);
          }
          resolve(Array.isArray(results) ? results : []);
        });
      } else {
        // Promise-based db
        db.query(query, [proCode, months])
          .then(([results]) => {
            resolve(Array.isArray(results) ? results : []);
          })
          .catch((err) => {
            console.error('DB Query Error:', err);
            reject(err);
          });
      }
    });
  }

  /**
   * Get latest reported month for a project
   * @param {string} proCode
   * @returns {Promise<string|null>}
   */
  static async getLatestReportMonthByProject(proCode) {
    if (!proCode) return null;
    const [rows] = await db.query(
      `SELECT MAX(report_month) AS latest_month
       FROM activity_monthly
       WHERE pro_code = ?`,
      [proCode]
    );
    return rows?.[0]?.latest_month || null;
  }
}

module.exports = PlanActivityMonthly;
