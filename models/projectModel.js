const db = require('../config/db');

const Project = {
  getAll: async (search = '') => {
    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE pro_story LIKE ?';
      params.push(`%${search}%`);
    }
    const [rows] = await db.query(`SELECT * FROM pt_project ${where} ORDER BY pro_year DESC, pro_order DESC`, params);
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM pt_project WHERE pro_id = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const { pro_order, pro_year, pro_no, pro_date, pro_from, pro_story, pro_filename, pro_saveby, pro_savedate } = data;
    await db.query(
      'INSERT INTO pt_project (pro_order, pro_year, pro_no, pro_date, pro_from, pro_story, pro_filename, pro_saveby, pro_savedate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pro_order, pro_year, pro_no, pro_date, pro_from, pro_story, pro_filename, pro_saveby, pro_savedate]
    );
  },
  update: async (id, data) => {
    const { pro_order, pro_year, pro_no, pro_date, pro_from, pro_story, pro_filename } = data;
    await db.query(
      'UPDATE pt_project SET pro_order=?, pro_year=?, pro_no=?, pro_date=?, pro_from=?, pro_story=?, pro_filename=? WHERE pro_id=?',
      [pro_order, pro_year, pro_no, pro_date, pro_from, pro_story, pro_filename, id]
    );
  },
  delete: async (id) => {
    await db.query('DELETE FROM pt_project WHERE pro_id = ?', [id]);
  },
  getLast: async (limit = 5) => {
    const [rows] = await db.query(
      'SELECT * FROM pt_project ORDER BY pro_savedate DESC, pro_year DESC, pro_order DESC LIMIT ?',
      [Number(limit)]
    );
    return rows;
  },
  getLastOrder: async () => {
    const [rows] = await db.query('SELECT MAX(pro_order) AS last_order FROM pt_project');
    return rows[0]?.last_order || 0;
  }
};

module.exports = Project;

