const db = require('../config/db');

module.exports = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM plan_kpi');
    return rows;
  },

  async findByPk(id) {
    const [rows] = await db.query('SELECT * FROM plan_kpi WHERE kp_id = ?', [id]);
    return rows[0];
  },

  async findByProjectCode(proCode) {
    const [rows] = await db.query('SELECT * FROM plan_kpi WHERE kp_procode = ?', [proCode]);
    return rows;
  },

  async create(data) {
    const {
      kp_number,
      kp_subject,
      kp_plan,
      kp_action,
      kp_unit,
      kp_procode,
      kp_saveby,
      kp_savedate
    } = data;

    const [result] = await db.query(
      'INSERT INTO plan_kpi (kp_number, kp_subject, kp_plan, kp_action, kp_unit, kp_procode, kp_saveby, kp_savedate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [kp_number, kp_subject, kp_plan, kp_action, kp_unit, kp_procode, kp_saveby, kp_savedate]
    );

    return result.insertId;
  },

  async update(id, data) {
    const {
      kp_number,
      kp_subject,
      kp_plan,
      kp_action,
      kp_unit,
      kp_procode,
      kp_saveby,
      kp_savedate
    } = data;

    await db.query(
      'UPDATE plan_kpi SET kp_number=?, kp_subject=?, kp_plan=?, kp_action=?, kp_unit=?, kp_procode=?, kp_saveby=?, kp_savedate=? WHERE kp_id=?',
      [kp_number, kp_subject, kp_plan, kp_action, kp_unit, kp_procode, kp_saveby, kp_savedate, id]
    );
  },

  async destroy(id) {
    await db.query('DELETE FROM plan_kpi WHERE kp_id=?', [id]);
  }
};
