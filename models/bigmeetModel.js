const db = require('../config/db');

const table = 'bigmeet';

module.exports = {
  async findAll() {
    const [rows] = await db.query(`
      SELECT b.*, c.c_name 
      FROM bigmeet b
      LEFT JOIN active_coop c ON b.big_code = c.c_code
      ORDER BY b.big_id DESC
    `);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE big_id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  },

  async create(data) {
    const payload = {
      big_code: data.big_code,
      big_endyear: data.big_endyear,
      big_type: data.big_type,
      big_date: data.big_date,
      big_saveby: data.big_saveby,
      big_savedate: data.big_savedate,
    };
    const [result] = await db.query(
      `INSERT INTO ${table} (big_code, big_endyear, big_type, big_date, big_saveby, big_savedate)
       VALUES (?, ?, ?, ?, ?, ?)`,

      [
        payload.big_code,
        payload.big_endyear,
        payload.big_type,
        payload.big_date,
        payload.big_saveby,
        payload.big_savedate,
      ]
    );
    return { big_id: result.insertId, ...payload };
  },

  async update(id, data) {
    const fields = ['big_code', 'big_endyear', 'big_type', 'big_date', 'big_saveby', 'big_savedate'];
    const setParts = [];
    const values = [];
    fields.forEach((f) => {
      if (data[f] !== undefined) {
        setParts.push(`${f} = ?`);
        values.push(data[f]);
      }
    });
    if (setParts.length === 0) return this.findById(id);
    values.push(id);
    await db.query(`UPDATE ${table} SET ${setParts.join(', ')} WHERE big_id = ?`, values);
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await db.query(`DELETE FROM ${table} WHERE big_id = ?`, [id]);
    return result.affectedRows > 0;
  },

  // Active cooperatives for select (c_group, c_code, c_name)
  async allcoop() {
    const [rows] = await db.query(
      'SELECT c_group, c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" ORDER BY c_group ASC, c_code ASC'
    );
    return rows;
  },

  // Distinct groups from active_coop
  async allcoopGroups() {
    const [rows] = await db.query(
      'SELECT DISTINCT c_group FROM active_coop WHERE c_status = "ดำเนินการ" ORDER BY c_group ASC'
    );
    return rows.map(r => r.c_group);
  },
};
