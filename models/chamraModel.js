const db = require('../config/db');


exports.getFiltered = ({ search, c_status, gr_step, page, page_size }) => {
    let sql = `
      SELECT d.*, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2
      FROM chamra_detail d
      LEFT JOIN active_coop ac ON d.de_code = ac.c_code
      WHERE 1=1
    `;
    const params = [];
  
    if (search) {
      sql += ` AND ac.c_name LIKE ?`;
      params.push(`%${search}%`);
    }
    if (c_status) {
      sql += ` AND ac.c_status = ?`;
      params.push(c_status);
    }
    if (gr_step) {
      sql += ` AND ac.gr_step = ?`;
      params.push(gr_step);
    }
  
    sql += ` ORDER BY d.de_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(page_size), (Number(page) - 1) * Number(page_size));
  
    return db.query(sql, params);
  };
  
  exports.countFiltered = ({ search, c_status, gr_step }) => {
    let sql = `
      SELECT COUNT(*) as total
      FROM chamra_detail d
      LEFT JOIN active_coop ac ON d.de_code = ac.c_code
      WHERE 1=1
    `;
    const params = [];
  
    if (search) {
      sql += ` AND ac.c_name LIKE ?`;
      params.push(`%${search}%`);
    }
    if (c_status) {
      sql += ` AND ac.c_status = ?`;
      params.push(c_status);
    }
    if (gr_step) {
      sql += ` AND ac.gr_step = ?`;
      params.push(gr_step);
    }
  
    return db.query(sql, params);
  };
  exports.getByCode = (code) => {
    const sql = `
      SELECT d.*, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2
      FROM chamra_detail d
      LEFT JOIN active_coop ac ON d.de_code = ac.c_code
      WHERE d.de_code = ?
      LIMIT 1
    `;
    return db.query(sql, [code]);
  };
  
  
  