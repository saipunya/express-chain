const db = require('../config/db');

module.exports = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM plan_project');
    return rows;
  },
  async findByCode(pro_code) {
    const [rows] = await db.query('SELECT * FROM plan_project WHERE pro_code = ?', [pro_code]);
    return rows[0];
  }
};
