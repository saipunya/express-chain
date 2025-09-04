const db = require('../config/db');

exports.getFiltered = ({ search, c_status, gr_step, page, page_size }) => {
  const sql = `
    SELECT d.*, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2, cg.gr_step,
           cp.pr_s1, cp.pr_s2, cp.pr_s3, cp.pr_s4, cp.pr_s5, cp.pr_s6, cp.pr_s7, cp.pr_s8, cp.pr_s9, cp.pr_s10
    FROM chamra_detail d
    LEFT JOIN active_coop ac ON d.de_code = ac.c_code
    LEFT JOIN (
      SELECT gr_code, gr_step
      FROM chamra_growth cg1
      WHERE gr_id = (
        SELECT MAX(gr_id)
        FROM chamra_growth cg2
        WHERE cg2.gr_code = cg1.gr_code
      )
    ) cg ON d.de_code = cg.gr_code
    LEFT JOIN chamra_process cp ON d.de_code = cp.pr_code
    WHERE 1=1
      ${search ? 'AND ac.c_name LIKE ?' : ''}
      ${c_status ? 'AND ac.c_status = ?' : ''}
      ${gr_step ? 'AND cg.gr_step = ?' : ''}
    ORDER BY d.de_id DESC
    LIMIT ? OFFSET ?
  `;

  const params = [];
  if (search) params.push(`%${search}%`);
  if (c_status) params.push(c_status);
  if (gr_step) params.push(gr_step);
  params.push(Number(page_size), (Number(page) - 1) * Number(page_size));

  return db.query(sql, params);
};

exports.countFiltered = ({ search, c_status, gr_step }) => {
  const sql = `
    SELECT COUNT(*) as total
    FROM chamra_detail d
    LEFT JOIN active_coop ac ON d.de_code = ac.c_code
    LEFT JOIN (
      SELECT gr_code, gr_step
      FROM chamra_growth cg1
      WHERE gr_id = (
        SELECT MAX(gr_id)
        FROM chamra_growth cg2
        WHERE cg2.gr_code = cg1.gr_code
      )
    ) cg ON d.de_code = cg.gr_code
    WHERE 1=1
      ${search ? 'AND ac.c_name LIKE ?' : ''}
      ${c_status ? 'AND ac.c_status = ?' : ''}
      ${gr_step ? 'AND cg.gr_step = ?' : ''}
  `;

  const params = [];
  if (search) params.push(`%${search}%`);
  if (c_status) params.push(c_status);
  if (gr_step) params.push(gr_step);

  return db.query(sql, params);
};

exports.getByCode = async (code) => {
  const sql = `
    SELECT d.*, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2, cg.gr_step,
           cp.pr_s1, cp.pr_s2, cp.pr_s3, cp.pr_s4, cp.pr_s5, cp.pr_s6, cp.pr_s7, cp.pr_s8, cp.pr_s9, cp.pr_s10
    FROM chamra_detail d
    LEFT JOIN active_coop ac ON d.de_code = ac.c_code
    LEFT JOIN (
      SELECT gr_code, gr_step
      FROM chamra_growth cg1
      WHERE gr_id = (
        SELECT MAX(gr_id)
        FROM chamra_growth cg2
        WHERE cg2.gr_code = cg1.gr_code
      )
    ) cg ON d.de_code = cg.gr_code
    LEFT JOIN chamra_process cp ON d.de_code = cp.pr_code
    WHERE d.de_code = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [code]);
  return rows[0]; // คืนค่า object แถวเดียว
};

exports.getAll = async () => {
  const sql = `
    SELECT d.*, ac.c_code AS c_code, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2,
           cp.pr_s1, cp.pr_s2, cp.pr_s3, cp.pr_s4, cp.pr_s5, cp.pr_s6, cp.pr_s7, cp.pr_s8, cp.pr_s9, cp.pr_s10
    FROM chamra_detail d
    LEFT JOIN active_coop ac ON d.de_code = ac.c_code
    LEFT JOIN chamra_process cp ON d.de_code = cp.pr_code
  `;
  const [rows] = await db.query(sql);
  return rows;
};


