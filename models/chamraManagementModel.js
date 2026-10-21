const db = require('../config/db');
const { normalizeDocumentName } = require('../services/chamraDocumentService');
const { TYPES } = require('../services/chamraManagementService');
function config(type) {
  if (!Object.hasOwn(TYPES, type)) throw new Error('Unknown management type');
  return TYPES[type];
}
module.exports = {
  async availableYears() {
    const processDates = Array.from({ length: 10 }, (_, i) => `SELECT pr_s${i + 1} AS activity_date FROM chamra_process`).join(' UNION ALL ');
    const queries = [
      ...Object.values(TYPES).map(({ table }) => `SELECT DISTINCT fiscal_year FROM ${table}`),
      'SELECT DISTINCT po_year AS fiscal_year FROM chamra_poblem',
      `SELECT DISTINCT YEAR(activity_date) + 543 + (MONTH(activity_date) >= 10) AS fiscal_year FROM (${processDates}) dates WHERE activity_date >= '1950-01-01'`
    ];
    const results = await Promise.allSettled(queries.map(sql => db.query(sql)));
    const years = new Set();
    for (const result of results) {
      if (result.status === 'rejected') {
        if (result.reason.code === 'ER_NO_SUCH_TABLE') continue;
        throw result.reason;
      }
      for (const row of result.value[0]) {
        const year = Number(row.fiscal_year);
        if (Number.isInteger(year) && year >= 2500 && year <= 2800) years.add(year);
      }
    }
    return [...years].sort((a, b) => b - a);
  },
  async list(type, year) {
    const { table } = config(type);
    const select = type === 'targets' ? "t.*, ac.c_name, cd.de_person AS responsible, DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date" : type === 'meetings' ? "t.*, DATE_FORMAT(t.meeting_date, '%Y-%m-%d') AS meeting_date" : 't.*';
    const join = type === 'targets' ? 'LEFT JOIN active_coop ac ON ac.c_code = t.c_code LEFT JOIN chamra_detail cd ON cd.de_code = t.c_code' : '';
    const order = type === 'documents' ? 't.is_pinned DESC, t.id DESC' : type === 'meetings' ? 't.meeting_no DESC' : 't.id ASC';
    const [rows] = await db.query(`SELECT ${select} FROM ${table} t ${join} WHERE t.fiscal_year = ? ORDER BY ${order}`, [year]);
    if (type === 'documents') rows.forEach(row => { row.original_name = normalizeDocumentName(row.original_name); });
    return rows;
  },
  async get(type, id) {
    const dates = type === 'targets' ? ", DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date" : type === 'meetings' ? ", DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meeting_date" : '';
    const [rows] = await db.query(`SELECT *${dates} FROM ${config(type).table} WHERE id = ?`, [id]);
    if (type === 'documents' && rows[0]) rows[0].original_name = normalizeDocumentName(rows[0].original_name);
    return rows[0] || null;
  },
  async save(type, id, data, user) {
    const { table, fields } = config(type);
    const keys = fields.filter(key => Object.hasOwn(data, key));
    const values = keys.map(key => data[key]);
    if (id) return db.query(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_by = ? WHERE id = ?`, [...values, user, id]);
    return db.query(`INSERT INTO ${table} (${keys.join(', ')}, updated_by) VALUES (${[...keys, 'updated_by'].map(() => '?').join(', ')})`, [...values, user]);
  },
  async remove(type, id) {
    return db.query(`DELETE FROM ${config(type).table} WHERE id = ?`, [id]);
  },
  async institutions() {
    const [rows] = await db.query("SELECT ac.c_code, ac.c_name, cd.de_person FROM active_coop ac LEFT JOIN chamra_detail cd ON cd.de_code = ac.c_code WHERE c_status IN ('เลิก', 'เลิก/ชำระบัญชี') ORDER BY c_name");
    return rows;
  },
  async institution(code) {
    const [rows] = await db.query('SELECT ac.c_code, ac.c_name, cd.de_person FROM active_coop ac LEFT JOIN chamra_detail cd ON cd.de_code = ac.c_code WHERE ac.c_code = ? LIMIT 1', [code]);
    return rows[0] || null;
  },
  async institutionExists(code) {
    const [rows] = await db.query('SELECT c_code FROM active_coop WHERE c_code = ? LIMIT 1', [code]);
    return rows.length > 0;
  }
};
