const db = require('../config/db');

exports.getFiltered = ({ search, c_status, gr_step, page, page_size }) => {
  const sql = `
    SELECT d.*, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2, cg.gr_step
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

exports.getByCode = (code) => {
  const sql = `
    SELECT d.*, ac.c_name, ac.c_status, ac.c_group, ac.c_person, ac.c_person2, cg.gr_step
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
    WHERE d.de_code = ?
    LIMIT 1
  `;
  return db.query(sql, [code]);
};
exports.getAll = async () =>{
 const [rows] = await db.query("SELECT * FROM chamra_detail LEFT JOIN active_coop ON chamra_detail.de_code = active_coop.c_code");
 return rows;

}
