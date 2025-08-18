const db = require('../config/db');

const Suggestion = {
  getAll: async (search = '') => {
    let where = '';
    const params = [];
    if (search) { 
      where = 'WHERE fi_subject LIKE ? OR fi_keyword LIKE ? OR fi_type LIKE ?'; 
      params.push(`%${search}%`, `%${search}%`, `%${search}%`); 
    }
    const [rows] = await db.query(`SELECT * FROM tbl_filename ${where} ORDER BY fi_savedate DESC, fi_id DESC`, params);
    return rows;
  },

  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM tbl_filename WHERE fi_id = ?', [id]);
    return rows[0];
  },

  create: async (data) => {
    const { fi_subject, fi_keyword, fi_type, fi_file, fi_saveby, fi_savedate } = data;
    await db.query(
      'INSERT INTO tbl_filename (fi_subject, fi_keyword, fi_type, fi_file, fi_saveby, fi_savedate) VALUES (?, ?, ?, ?, ?, ?)',
      [fi_subject, fi_keyword, fi_type, fi_file, fi_saveby, fi_savedate]
    );
  },

  update: async (id, data) => {
    const { fi_subject, fi_keyword, fi_type, fi_file } = data;
    await db.query(
      'UPDATE tbl_filename SET fi_subject = ?, fi_keyword = ?, fi_type = ?, fi_file = ? WHERE fi_id = ?',
      [fi_subject, fi_keyword, fi_type, fi_file, id]
    );
  },

  delete: async (id) => {
    await db.query('DELETE FROM tbl_filename WHERE fi_id = ?', [id]);
  }
};

module.exports = Suggestion;