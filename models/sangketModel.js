const db = require('../config/db');

const Sangket = {
  // Paged list with optional search
  async getPaged(search = '', page = 1, pageSize = 10) {
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(pageSize, 10));
    const params = [];
    let where = '';
    if (search) {
      where = `WHERE sang_name LIKE ? OR sang_code LIKE ? OR sang_group LIKE ?`;
      const kw = `%${search}%`;
      params.push(kw, kw, kw);
    }
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM tbl_sangket ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM tbl_sangket ${where} ORDER BY sang_savedate DESC, sang_id DESC LIMIT ?, ?`,
      [...params, offset, Math.max(1, parseInt(pageSize, 10))]
    );
    return { rows, total };
  },

  async getById(id) {
    const [rows] = await db.query('SELECT * FROM tbl_sangket WHERE sang_id = ?', [id]);
    return rows[0];
  },

  async create(data) {
    const sql = `INSERT INTO tbl_sangket (
      sang_group, sang_code, sang_name, sang_enddate, sang_rabbook, sang_rabdate,
      sang_accounter, sang_check, sang_detail, sang_money, sang_type, sang_sentbook,
      sang_sentdate, sang_category, sang_maihed, sang_status, sang_saveby, sang_savedate
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    const vals = [
      data.sang_group || '',
      data.sang_code || '',
      data.sang_name || '',
      data.sang_enddate || null,
      data.sang_rabbook || '',
      data.sang_rabdate || null,
      data.sang_accounter || '',
      data.sang_check || '',
      data.sang_detail || '',
      data.sang_money ?? null,
      data.sang_type || '',
      data.sang_sentbook || '',
      data.sang_sentdate || null,
      data.sang_category || '',
      data.sang_maihed ?? null,
      data.sang_status || '',
      data.sang_saveby || 'system',
      data.sang_savedate || new Date()
    ];

    const [result] = await db.query(sql, vals);
    return result.insertId;
  },

  async update(id, data) {
    const sql = `UPDATE tbl_sangket SET
      sang_group=?, sang_code=?, sang_name=?, sang_enddate=?, sang_rabbook=?, sang_rabdate=?,
      sang_accounter=?, sang_check=?, sang_detail=?, sang_money=?, sang_type=?, sang_sentbook=?,
      sang_sentdate=?, sang_category=?, sang_maihed=?, sang_status=?, sang_saveby=?, sang_savedate=?
      WHERE sang_id = ?`;
    const vals = [
      data.sang_group || '',
      data.sang_code || '',
      data.sang_name || '',
      data.sang_enddate || null,
      data.sang_rabbook || '',
      data.sang_rabdate || null,
      data.sang_accounter || '',
      data.sang_check || '',
      data.sang_detail || '',
      data.sang_money ?? null,
      data.sang_type || '',
      data.sang_sentbook || '',
      data.sang_sentdate || null,
      data.sang_category || '',
      data.sang_maihed ?? null,
      data.sang_status || '',
      data.sang_saveby || 'system',
      data.sang_savedate || new Date(),
      id
    ];
    const [result] = await db.query(sql, vals);
    return result;
  },

  async delete(id) {
    const [result] = await db.query('DELETE FROM tbl_sangket WHERE sang_id = ?', [id]);
    return result;
  }
};

module.exports = Sangket;
