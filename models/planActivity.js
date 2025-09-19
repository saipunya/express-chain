const db = require('../config/db');

module.exports = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM plan_activity');
    return rows;
  },
  async findByPk(id) {
    const [rows] = await db.query('SELECT * FROM plan_activity WHERE ac_id = ?', [id]);
    return rows[0];
  },
  async create(data) {
    const { ac_number, ac_subject, ac_status, ac_procode, ac_saveby, ac_savedate } = data;
    const [result] = await db.query(
      'INSERT INTO plan_activity (ac_number, ac_subject, ac_status, ac_procode, ac_saveby, ac_savedate) VALUES (?, ?, ?, ?, ?, ?)',
      [ac_number, ac_subject, ac_status, ac_procode, ac_saveby, ac_savedate]
    );
    return result.insertId;
  },
  async update(id, data) {
    const { ac_number, ac_subject, ac_status, ac_procode, ac_saveby, ac_savedate } = data;
    await db.query(
      'UPDATE plan_activity SET ac_number=?, ac_subject=?, ac_status=?, ac_procode=?, ac_saveby=?, ac_savedate=? WHERE ac_id=?',
      [ac_number, ac_subject, ac_status, ac_procode, ac_saveby, ac_savedate, id]
    );
  },
  async destroy(id) {
    await db.query('DELETE FROM plan_activity WHERE ac_id=?', [id]);
  }
};
