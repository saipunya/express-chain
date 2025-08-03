const db = require('../config/db');

const UseCar = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM pt_usecar WHERE date_car >= CURDATE() ORDER BY id_usecar ASC');
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM pt_usecar WHERE id_usecar = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const { date_car, time_car, act_car, place_car, no_car, respon_car, comment_car, no_book, use_refuel, list_budget, saveby, savedate } = data;
    await db.query(
      'INSERT INTO pt_usecar (date_car, time_car, act_car, place_car, no_car, respon_car, comment_car, no_book, use_refuel, list_budget, saveby, savedate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [date_car, time_car, act_car, place_car, no_car, respon_car, comment_car, no_book, use_refuel, list_budget, saveby, savedate]
    );
  },
  update: async (id, data) => {
    const { date_car, time_car, act_car, place_car, no_car, respon_car, comment_car, no_book, use_refuel, list_budget, saveby, savedate } = data;
    await db.query(
      'UPDATE pt_usecar SET date_car = ?, time_car = ?, act_car = ?, place_car = ?, no_car = ?, respon_car = ?, comment_car = ?, no_book = ?, use_refuel = ?, list_budget = ?, saveby = ?, savedate = ? WHERE id_usecar = ?',
      [date_car, time_car, act_car, place_car, no_car, respon_car, comment_car, no_book, use_refuel, list_budget, saveby, savedate, id]
    );
  },
  delete: async (id) => {
    await db.query('DELETE FROM pt_usecar WHERE id_usecar = ?', [id]);
  },
};

module.exports = UseCar;