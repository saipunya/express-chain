const db = require('../config/db');
// Aggregate full profile of a cooperative / farmer group by c_code
// Returns: { coop, finance:[], business:[], rules:[], vong:[], rabiab:[] }
exports.getProfileByCode = async (c_code) => {
  // Parallel queries
  const coopPromise = db.query('SELECT * FROM active_coop WHERE c_code = ? LIMIT 1', [c_code]);
  const financePromise = db.query('SELECT id, c_code, c_name, end_year, file_name, link_file, saveby, savedate FROM kb_finance WHERE c_code = ? ORDER BY end_year DESC, id DESC', [c_code]);
  const businessPromise = db.query('SELECT bu_id, bu_code, bu_name, bu_endyear, bu_filename, bu_saveby, bu_savedate FROM kb_allbusiness WHERE bu_code = ? ORDER BY bu_endyear DESC, bu_id DESC', [c_code]);
  const rulesPromise = db.query('SELECT rule_id, rule_code, rule_name, rule_type, rule_year, er_no, rule_file, rule_saveby, rule_savedate FROM kt_rule WHERE rule_code = ? ORDER BY rule_year DESC, rule_id DESC', [c_code]);
  // vong (เงินกองทุน)
  const vongPromise = db.query('SELECT vong_id, vong_year, vong_money, vong_date, vong_filename FROM vong_coop WHERE vong_code = ? ORDER BY vong_year DESC, vong_id DESC', [c_code]);
  // rabiab (ระเบียบ) ใหม่
  const rabiabPromise = db.query('SELECT ra_id, ra_code, ra_name, ra_year, ra_approvedate, ra_filename, ra_saveby, ra_savedate FROM tbl_rabiab WHERE ra_code = ? AND ra_status = "active" ORDER BY ra_year DESC, ra_id DESC', [c_code]);
  const [[coopRows], [financeRows], [businessRows], [ruleRows], [vongRows], [rabiabRows]] = await Promise.all([coopPromise, financePromise, businessPromise, rulesPromise, vongPromise, rabiabPromise]);
  return {
    coop: coopRows[0] || null,
    finance: financeRows,
    business: businessRows,
    rules: ruleRows,
    vong: vongRows,
    rabiab: rabiabRows
  };
};
// List cooperatives by group for navigation (legacy)
exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query('SELECT c_code, c_name, coop_group, c_group FROM active_coop WHERE c_group = ? AND c_status = "ดำเนินการ" ORDER BY c_name ASC', [group]);
  return rows;
};
// Distinct groups for dropdown
exports.getGroups = async () => {
  const [rows] = await db.query('SELECT DISTINCT c_group FROM active_coop WHERE c_group IS NOT NULL AND c_group <> "" ORDER BY c_group');
  return rows.map(r => r.c_group);
};
// New: unified search (all or by group) with optional text search on name or code or group (when not fixed group)
exports.searchCoops = async ({ group = null, q = null }) => {
  const params = [];
  let sql = 'SELECT c_code, c_name, coop_group, c_group FROM active_coop WHERE c_status = "ดำเนินการ"';
  if (group) {
    sql += ' AND c_group = ?';
    params.push(group);
  }
  if (q) {
    if (group) {
      sql += ' AND (c_name LIKE ? OR c_code LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like);
    } else {
      sql += ' AND (c_name LIKE ? OR c_code LIKE ? OR c_group LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
  }
  sql += ' ORDER BY c_name ASC';
  const [rows] = await db.query(sql, params);
  return rows;
};
