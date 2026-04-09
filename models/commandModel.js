const db = require('../config/db');

const Command = {
  getAll: async (search = '') => {
    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE com_story LIKE ? OR com_from LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    const [rows] = await db.query(`SELECT * FROM pt_command ${where} ORDER BY com_date DESC, command_id DESC`, params);
    return rows;
  },

  getList: async ({ search = '', page = 1, pageSize = 10 } = {}) => {
    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE com_story LIKE ? OR com_from LIKE ? OR com_no LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total = 0 } = {}]] = await db.query(
      `SELECT COUNT(*) AS total FROM pt_command ${where}`,
      params
    );

    const offset = Math.max(0, (Number(page) - 1) * Number(pageSize));
    const [items] = await db.query(
      `SELECT * FROM pt_command ${where} ORDER BY com_date DESC, command_id DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset]
    );

    return { items, total: Number(total || 0) };
  },

  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM pt_command WHERE command_id = ?', [id]);
    return rows[0];
  },

  create: async (data) => {
    const { com_no, com_date, com_from, com_story, com_filename, com_saveby, com_savedate } = data;
    await db.query(
      'INSERT INTO pt_command (com_no, com_date, com_from, com_story, com_filename, com_saveby, com_savedate) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [com_no, com_date, com_from, com_story, com_filename, com_saveby, com_savedate]
    );
  },

  update: async (id, data) => {
    const { com_no, com_date, com_from, com_story, com_filename } = data;
    await db.query(
      'UPDATE pt_command SET com_no = ?, com_date = ?, com_from = ?, com_story = ?, com_filename = ? WHERE command_id = ?',
      [com_no, com_date, com_from, com_story, com_filename, id]
    );
  },

  delete: async (id) => {
    await db.query('DELETE FROM pt_command WHERE command_id = ?', [id]);
  },

  getLastOrder: async () => {
    const [rows] = await db.query('SELECT * FROM pt_command ORDER BY com_year DESC , com_no DESC LIMIT 1');
    const lastOrder = rows[0]?.last_no

    return lastOrder || 0;
  }
,

  getLast: async (limit = 10) => {
    const [rows] = await db.query(
      'SELECT * FROM pt_command ORDER BY com_date DESC, command_id DESC LIMIT ?',
      [Number(limit)]
    );
    return rows;
  }

};


module.exports = Command;