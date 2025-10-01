const db = require('../config/db');
// Aggregate full profile of a cooperative / farmer group by c_code
// Returns: { coop, finance:[], business:[], rules:[], vong:[] }
exports.getProfileByCode = async (c_code) => {
  // Parallel queries
  const coopPromise = db.query('SELECT * FROM active_coop WHERE c_code = ? LIMIT 1', [c_code]);
  const financePromise = db.query('SELECT id, c_code, c_name, end_year, file_name, link_file, saveby, savedate FROM kb_finance WHERE c_code = ? ORDER BY end_year DESC, id DESC', [c_code]);
  const businessPromise = db.query('SELECT bu_id, bu_code, bu_name, bu_endyear, bu_filename, bu_saveby, bu_savedate FROM kb_allbusiness WHERE bu_code = ? ORDER BY bu_endyear DESC, bu_id DESC', [c_code]);
  const rulesPromise = db.query('SELECT rule_id, rule_code, rule_name, rule_type, rule_year, er_no, rule_file, rule_saveby, rule_savedate FROM kt_rule WHERE rule_code = ? ORDER BY rule_year DESC, rule_id DESC', [c_code]);
  // NEW: vong (เงินกองทุน) ต่อรหัสสหกรณ์
  const vongPromise = db.query('SELECT vong_id, vong_year, vong_money, vong_date, vong_filename FROM vong_coop WHERE vong_code = ? ORDER BY vong_year DESC, vong_id DESC', [c_code]);
  const [[coopRows], [financeRows], [businessRows], [ruleRows], [vongRows]] = await Promise.all([coopPromise, financePromise, businessPromise, rulesPromise, vongPromise]);
  return {
    coop: coopRows[0] || null,
    finance: financeRows,
    business: businessRows,
    rules: ruleRows,
    vong: vongRows
  };
};
// List cooperatives by group for navigation
exports.getCoopsByGroup = async (group) => {
  const [rows] = await db.query('SELECT c_code, c_name, coop_group, c_group FROM active_coop WHERE c_group = ? AND c_status = "ดำเนินการ" ORDER BY c_name ASC', [group]);
  return rows;
};
// Distinct groups for dropdown
exports.getGroups = async () => {
  const [rows] = await db.query('SELECT DISTINCT c_group FROM active_coop WHERE c_group IS NOT NULL AND c_group <> "" ORDER BY c_group');
  return rows.map(r => r.c_group);
};
