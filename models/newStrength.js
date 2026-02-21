const db = require('../config/db');

module.exports = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM new_strength ORDER BY str_id DESC');
    return rows;
  },

  async findByPk(id) {
    const [rows] = await db.query('SELECT * FROM new_strength WHERE str_id = ?', [id]);
    return rows[0];
  },

  async findByCode(code) {
    const [rows] = await db.query('SELECT * FROM new_strength WHERE str_code = ? LIMIT 1', [code]);
    return rows[0];
  },

  async create(data) {
    const { str_code, str_group, str_grade, str_saveby, str_savedate } = data;
    const [result] = await db.query(
      'INSERT INTO new_strength (str_code, str_group, str_grade, str_saveby, str_savedate) VALUES (?, ?, ?, ?, ?)',
      [str_code, str_group, str_grade, str_saveby, str_savedate]
    );
    return result.insertId;
  },

  async update(id, data) {
    const { str_code, str_group, str_grade, str_saveby, str_savedate } = data;
    await db.query(
      'UPDATE new_strength SET str_code=?, str_group=?, str_grade=?, str_saveby=?, str_savedate=? WHERE str_id=?',
      [str_code, str_group, str_grade, str_saveby, str_savedate, id]
    );
  },

  async destroy(id) {
    await db.query('DELETE FROM new_strength WHERE str_id=?', [id]);
  }
};
