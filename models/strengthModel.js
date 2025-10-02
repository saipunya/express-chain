const db = require('../config/db');

// Bulk insert or update strength rows
// rows: array of objects with keys matching columns
exports.bulkUpsert = async (rows = []) => {
  if (!rows.length) return { inserted: 0, affected: 0 };
  const fields = [
    'st_code','st_fullname','st_year','st_no1','st_no2','st_no3','st_no4','st_cpd','st_cad','st_point','st_grade'
  ];
  const values = rows.map(r => fields.map(f => r[f]));
  const placeholders = values.map(() => '(' + fields.map(()=>'?').join(',') + ')').join(',');
  const sql = `INSERT INTO tbl_strength (${fields.join(',')}) VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE 
      st_fullname=VALUES(st_fullname),
      st_year=VALUES(st_year),
      st_no1=VALUES(st_no1),
      st_no2=VALUES(st_no2),
      st_no3=VALUES(st_no3),
      st_no4=VALUES(st_no4),
      st_cpd=VALUES(st_cpd),
      st_cad=VALUES(st_cad),
      st_point=VALUES(st_point),
      st_grade=VALUES(st_grade)`;
  const flat = values.flat();
  const [result] = await db.query(sql, flat);
  return { inserted: result.affectedRows, affected: result.affectedRows };
};

exports.getRecent = async (limit = 50) => {
  const [rows] = await db.query('SELECT * FROM tbl_strength ORDER BY st_year DESC, st_code ASC LIMIT ?', [limit]);
  return rows;
};

// Replace getGradeCounts with year-aware version
exports.getGradeCounts = async (year = null) => {
  let sql = `SELECT ac.coop_group, s.st_grade, s.st_year, COUNT(*) AS total
             FROM tbl_strength s
             JOIN active_coop ac ON ac.c_code = s.st_code
             WHERE s.st_grade IS NOT NULL AND s.st_grade <> ''`;
  const params = [];
  if (year) { sql += ' AND s.st_year = ?'; params.push(year); }
  sql += ' GROUP BY ac.coop_group, s.st_grade, s.st_year ORDER BY s.st_year DESC, ac.coop_group, s.st_grade';
  const [rows] = await db.query(sql, params);
  return rows;
};

// Get latest st_year present in tbl_strength
exports.getLatestYear = async () => {
  const [rows] = await db.query('SELECT MAX(st_year) AS latest FROM tbl_strength');
  return rows[0]?.latest || null;
};

// Get detailed list for a coop_group and year
exports.getDetailsByGroupAndYear = async (coopGroup, year) => {
  const [rows] = await db.query(`
    SELECT s.st_code, s.st_fullname, s.st_point, s.st_grade, s.st_year
    FROM tbl_strength s
    JOIN active_coop ac ON ac.c_code = s.st_code
    WHERE ac.coop_group = ? AND s.st_year = ? AND s.st_grade IS NOT NULL AND s.st_grade <> ''
    ORDER BY s.st_grade ASC, s.st_point DESC, s.st_fullname ASC
  `, [coopGroup, year]);
  return rows;
};

// Fetch all strength rows for a specific institution code ordered by year desc
exports.getByCode = async (code) => {
  const [rows] = await db.query(`SELECT * FROM tbl_strength WHERE st_code = ? ORDER BY st_year DESC`, [code]);
  return rows;
};

// Fetch institution profile (join active_coop) if available
exports.getInstitutionProfile = async (code) => {
  const [rows] = await db.query(`
    SELECT ac.c_code, ac.c_name, ac.coop_group, ac.c_type, ac.c_amp, ac.c_tambon
    FROM active_coop ac WHERE ac.c_code = ? LIMIT 1
  `, [code]);
  return rows[0] || null;
};
