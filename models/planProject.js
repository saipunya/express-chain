const db = require('../config/db');

module.exports = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM plan_project');
    return rows;
  },
  async findAllByResponsibleId(responId) {
    try {
      const [rows] = await db.query('SELECT * FROM plan_project WHERE pro_respon_id = ? ORDER BY pro_id DESC', [responId]);
      return rows;
    } catch (e) {
      // Backward compatibility if DB is not migrated yet
      if (String(e && e.code) === 'ER_BAD_FIELD_ERROR') {
        return [];
      }
      throw e;
    }
  },
  async findByCode(pro_code) {
    const [rows] = await db.query('SELECT * FROM plan_project WHERE pro_code = ?', [pro_code]);
    return rows[0];
  }
};
