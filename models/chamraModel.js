const db = require('../config/db');

// Helper to normalize empty string -> null
const nz = v => (v === '' || typeof v === 'undefined' ? null : v);

// --- existing query functions kept ---
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
    ORDER BY ac.c_status DESC , ac.c_name DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
};

exports.getAllPob = async () =>{
  const sql = `
  SELECT p.*, ac.c_name
FROM chamra_poblem p
LEFT JOIN active_coop ac ON p.po_code = ac.c_code
  `;
  const [rows] = await db.query(sql);
  return rows;
};

// Create (insert) into chamra_detail (NOT non-existent 'chamra')
async function create(data) {
  const savedate = (data.de_savedate && /^\d{4}-\d{2}-\d{2}$/.test(data.de_savedate))
    ? data.de_savedate
    : new Date();
  const sql = `
    INSERT INTO chamra_detail
      (de_code, de_case, de_comno, de_comdate, de_person,
       de_maihed, de_saveby, de_savedate)
    VALUES (?,?,?,?,?,?,?,?)
  `;
  const params = [
    nz(data.de_code),
    nz(data.de_case),
    nz(data.de_comno),
    nz(data.de_comdate),
    nz(data.de_person),
    (data.de_maihed == null ? '' : data.de_maihed),
    (data.de_saveby == null || data.de_saveby === '' ? 'system' : data.de_saveby),
    savedate
  ];
  await db.query(sql, params);
  return true;
}

// Update stub (extend as needed)
async function update(c_code, { active, detail, process }) {
  // Without full schema details, provide no-op or minimal update logic.
  // Example (uncomment and adjust when columns defined):
  // await db.query('UPDATE chamra_detail SET de_case=? WHERE de_code=?', [detail.de_case, c_code]);
  return true;
}

// Delete by code (remove all rows for code)
async function remove(c_code) {
  await db.query('DELETE FROM chamra_detail WHERE de_code = ?', [c_code]);
  return true;
}

// ---- chamra_process helpers ----
async function getAllProcess() {
  const [rows] = await db.query(`
    SELECT cp.*, ac.c_name
    FROM chamra_process cp
    LEFT JOIN active_coop ac ON cp.pr_code = ac.c_code
    ORDER BY cp.pr_code
  `);
  return rows;
}

async function getProcessById(pr_id) {
  const [rows] = await db.query(`
    SELECT cp.*, ac.c_name
    FROM chamra_process cp
    LEFT JOIN active_coop ac ON cp.pr_code = ac.c_code
    WHERE cp.pr_id = ?
  `, [pr_id]);
  return rows[0] || null;
}

async function updateProcess(pr_id, data) {
  const fields = ['pr_s1','pr_s2','pr_s3','pr_s4','pr_s5','pr_s6','pr_s7','pr_s8','pr_s9','pr_s10'];
  const setSql = fields.map(f => `${f}=?`).join(',');
  const params = fields.map(f => (data[f] && data[f] !== '' ? data[f] : '0000-00-00'));
  params.push(pr_id);
  await db.query(`UPDATE chamra_process SET ${setSql} WHERE pr_id = ?`, params);
  return true;
}

async function deleteProcess(pr_id) {
  await db.query('DELETE FROM chamra_process WHERE pr_id = ?', [pr_id]);
  return true;
}

// Export unified API object (avoid shape confusion)
module.exports = {
  getFiltered: exports.getFiltered,
  countFiltered: exports.countFiltered,
  getByCode: exports.getByCode,
  getAll: exports.getAll,
  getAllPob: exports.getAllPob,
  create,
  update,
  delete: remove,
  // process exports
  getAllProcess,
  getProcessById,
  updateProcess,
  deleteProcess
};


