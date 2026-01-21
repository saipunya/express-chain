const db = require('../config/db');

module.exports = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM plan_activity');
    return rows;
  },
  async findByProjectCode(proCode) {
    const [rows] = await db.query('SELECT * FROM plan_activity WHERE ac_procode = ? ORDER BY ac_number ASC', [proCode]);
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
  async createMany(items) {
    if (!Array.isArray(items) || items.length === 0) return 0;

    const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const values = [];
    for (const item of items) {
      values.push(
        item.ac_number,
        item.ac_subject,
        item.ac_status,
        item.ac_procode,
        item.ac_saveby,
        item.ac_savedate
      );
    }

    const [result] = await db.query(
      `INSERT INTO plan_activity (ac_number, ac_subject, ac_status, ac_procode, ac_saveby, ac_savedate)
       VALUES ${placeholders}`,
      values
    );

    return result.affectedRows || 0;
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
