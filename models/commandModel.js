const db = require('../config/db');

const Command = {
  getAll: async (search = '') => {
    let where = '';
    const params = [];
    if (search) { 
      where = 'WHERE cmd_title LIKE ? OR cmd_from LIKE ?'; 
      params.push(`%${search}%`, `%${search}%`); 
    }
    const [rows] = await db.query(`SELECT * FROM pt_command ${where} ORDER BY cmd_date DESC, cmd_id DESC`, params);
    return rows;
  },

  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM pt_command WHERE cmd_id = ?', [id]);
    return rows[0];
  },

  create: async (data) => {
    const { cmd_no, cmd_date, cmd_from, cmd_title, cmd_filename, cmd_saveby, cmd_savedate } = data;
    await db.query(
      'INSERT INTO pt_command (cmd_no, cmd_date, cmd_from, cmd_title, cmd_filename, cmd_saveby, cmd_savedate) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cmd_no, cmd_date, cmd_from, cmd_title, cmd_filename, cmd_saveby, cmd_savedate]
    );
  },

  update: async (id, data) => {
    const { cmd_no, cmd_date, cmd_from, cmd_title, cmd_filename } = data;
    await db.query(
      'UPDATE pt_command SET cmd_no = ?, cmd_date = ?, cmd_from = ?, cmd_title = ?, cmd_filename = ? WHERE cmd_id = ?',
      [cmd_no, cmd_date, cmd_from, cmd_title, cmd_filename, id]
    );
  },

  delete: async (id) => {
    await db.query('DELETE FROM pt_command WHERE cmd_id = ?', [id]);
  },

  getLastOrder: async () => {
    const [rows] = await db.query('SELECT MAX(cmd_no) as last_no FROM pt_command');
    return rows[0]?.last_no || 0;
  }
};

module.exports = Command;