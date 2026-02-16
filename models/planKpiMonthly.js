const db = require('../config/db');

module.exports = {
  async findByPk(id) {
    const [rows] = await db.query('SELECT * FROM plan_kpi_monthly WHERE id = ?', [id]);
    return rows[0];
  },

  async findByKpi(kpId) {
    const [rows] = await db.query(
      'SELECT * FROM plan_kpi_monthly WHERE kp_id = ? ORDER BY report_month ASC',
      [kpId]
    );
    return rows;
  },

  async findByMonth(kpId, reportMonth) {
    const [rows] = await db.query(
      'SELECT * FROM plan_kpi_monthly WHERE kp_id = ? AND report_month = ?',
      [kpId, reportMonth]
    );
    return rows[0];
  },

  async findByKpiIdsAndMonth(kpiIds, reportMonth) {
    if (!Array.isArray(kpiIds) || !kpiIds.length) {
      return [];
    }

    const placeholders = kpiIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM plan_kpi_monthly WHERE kp_id IN (${placeholders}) AND report_month = ?`,
      [...kpiIds, reportMonth]
    );
    return rows;
  },

  async create(data) {
    const {
      kp_id,
      report_month,
      actual_value,
      note,
      created_by
    } = data;

    const [result] = await db.query(
      'INSERT INTO plan_kpi_monthly (kp_id, report_month, actual_value, note, created_by) VALUES (?, ?, ?, ?, ?)',
      [kp_id, report_month, actual_value, note, created_by]
    );

    return result.insertId;
  },

  async update(id, data) {
    const {
      report_month,
      actual_value,
      note,
      created_by
    } = data;

    await db.query(
      'UPDATE plan_kpi_monthly SET report_month = ?, actual_value = ?, note = ?, created_by = ? WHERE id = ?',
      [report_month, actual_value, note, created_by, id]
    );
  },

  async destroy(id) {
    await db.query('DELETE FROM plan_kpi_monthly WHERE id = ?', [id]);
  },

  async upsertMany(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return 0;
    }

    const placeholders = rows.map(() => '(?, ?, ?, ?, ?)').join(',');
    const values = [];

    rows.forEach((row) => {
      values.push(
        row.kp_id,
        row.report_month,
        row.actual_value,
        row.note ?? null,
        row.created_by ?? null
      );
    });

    const [result] = await db.query(
      `INSERT INTO plan_kpi_monthly (kp_id, report_month, actual_value, note, created_by)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         actual_value = VALUES(actual_value),
         note = VALUES(note),
         created_by = VALUES(created_by),
         updated_at = CURRENT_TIMESTAMP`,
      values
    );

    return result.affectedRows || 0;
  },

  async sumByKpi(kpId) {
    const [rows] = await db.query(
      'SELECT COALESCE(SUM(actual_value), 0) AS total FROM plan_kpi_monthly WHERE kp_id = ?',
      [kpId]
    );
    return rows[0]?.total || 0;
  },

  async sumForIds(ids) {
    if (!ids?.length) {
      return {};
    }

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT kp_id, COALESCE(SUM(actual_value), 0) AS total FROM plan_kpi_monthly WHERE kp_id IN (${placeholders}) GROUP BY kp_id`,
      ids
    );

    return rows.reduce((acc, row) => {
      acc[row.kp_id] = row.total;
      return acc;
    }, {});
  },

  /**
   * Get historical monthly records for KPI by project (last N months)
   * @param {string} proCode - Project code
   * @param {number} months - Number of months to fetch (default 12)
   * @returns {Promise<Array>}
   */
  async getHistoricalByProject(proCode, months = 12) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE_FORMAT(km.report_month, '%Y-%m') AS report_month,
          km.report_month as report_month_full,
          COUNT(DISTINCT km.kp_id) as total_kpis,
          SUM(CASE WHEN (km.actual_value / pk.kp_plan * 100) >= 100 THEN 1 ELSE 0 END) as achieved,
          SUM(CASE WHEN (km.actual_value / pk.kp_plan * 100) >= 70 AND (km.actual_value / pk.kp_plan * 100) < 100 THEN 1 ELSE 0 END) as on_track,
          SUM(CASE WHEN (km.actual_value / pk.kp_plan * 100) < 70 THEN 1 ELSE 0 END) as behind,
          SUM(CASE WHEN pk.kp_plan IS NULL OR pk.kp_plan = 0 THEN 1 ELSE 0 END) as no_target,
          ROUND(AVG(CASE WHEN pk.kp_plan > 0 THEN (km.actual_value / pk.kp_plan * 100) ELSE NULL END), 1) as avg_achievement_percent
        FROM kpi_monthly km
        LEFT JOIN plan_kpi pk ON km.kp_id = pk.kp_id
        WHERE km.pro_code = ?
        GROUP BY DATE_FORMAT(km.report_month, '%Y-%m'), km.report_month
        ORDER BY km.report_month DESC
        LIMIT ?
      `;

      const db = require('../config/db');

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
};
