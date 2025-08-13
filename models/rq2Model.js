const db = require('../config/db');

const Rq2 = {
  getAll: async (search = '') => {
    let where = '';
    const params = [];
    if (search) { where = 'WHERE rq_name LIKE ?'; params.push(`%${search}%`); }
    const [rows] = await db.query(`SELECT * FROM tbl_rq2 ${where} ORDER BY rq_year DESC, rq_id DESC` , params);
    return rows;
  },

  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM tbl_rq2 WHERE rq_id = ?', [id]);
    return rows[0];
  },

  create: async (data) => {
    const { rq_code, rq_name, rq_year, rq_file, rq_saveby, rq_savedate } = data;
    await db.query(
      'INSERT INTO tbl_rq2 (rq_code, rq_name, rq_year, rq_file, rq_saveby, rq_savedate) VALUES (?, ?, ?, ?, ?, ?)',
      [rq_code, rq_name, rq_year, rq_file, rq_saveby, rq_savedate]
    );
  },

  update: async (id, data) => {
    const { rq_code, rq_name, rq_year, rq_file } = data;
    await db.query(
      'UPDATE tbl_rq2 SET rq_code=?, rq_name=?, rq_year=?, rq_file=? WHERE rq_id=?',
      [rq_code, rq_name, rq_year, rq_file, id]
    );
  },

  existsByCodeYear: async (rq_code, rq_year, excludeId = null) => {
    const params = [rq_code, rq_year];
    let sql = 'SELECT COUNT(*) AS cnt FROM tbl_rq2 WHERE rq_code = ? AND rq_year = ?';
    if (excludeId) { sql += ' AND rq_id <> ?'; params.push(excludeId); }
    const [rows] = await db.query(sql, params);
    return (rows[0]?.cnt || 0) > 0;
  },

  delete: async (id) => {
    await db.query('DELETE FROM tbl_rq2 WHERE rq_id = ?', [id]);
  },
  getLast: async (limit = 10) => {
    const [rows] = await db.query(
      'SELECT * FROM tbl_rq2 ORDER BY rq_id DESC LIMIT ?',
      [Number(limit)]
    );
    return rows;
  }
};

module.exports = Rq2;
