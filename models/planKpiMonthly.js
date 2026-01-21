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
  }
};
