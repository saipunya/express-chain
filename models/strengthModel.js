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

// Get latest st_year present in strength
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
    SELECT ac.c_code, ac.c_name, ac.coop_group, ac.c_type, ac.c_group
    FROM active_coop ac WHERE ac.c_code = ? LIMIT 1
  `, [code]);
  return rows[0] || null;
};

const getYears = async () => {
  const [rows] = await db.query('SELECT DISTINCT st_year FROM tbl_strength ORDER BY st_year DESC');
  return rows.map(r => r.st_year);
};

const getListByYearAndGroup = async (year, group) => {
  const [rows] = await db.query(`
    SELECT s.st_code, s.st_fullname, s.st_point, s.st_grade, ac.coop_group as st_group, s.st_year
    FROM tbl_strength s
    LEFT JOIN active_coop ac ON s.st_code = ac.c_code
    WHERE s.st_year = ? AND ac.coop_group = ? 
    ORDER BY s.st_point DESC, s.st_fullname ASC
  `, [year, group]);
  return rows || [];
};

const getSummaryByYear = async (year) => {
  const [rows] = await db.query(`
    SELECT 
      CASE 
        WHEN ac.coop_group = 'สหกรณ์' AND ac.in_out_group = 'ภาคการเกษตร' THEN 'สหกรณ์ภาคการเกษตร'
        WHEN ac.coop_group = 'สหกรณ์' THEN 'สหกรณ์นอกภาคการเกษตร'
        WHEN ac.coop_group = 'กลุ่มเกษตรกร' THEN 'กลุ่มเกษตรกร'
        WHEN ac.coop_group IS NOT NULL THEN ac.coop_group
        ELSE 'ไม่ระบุประเภท'
      END AS org_type,
      COUNT(DISTINCT s.st_code) AS total_count,
      COUNT(DISTINCT CASE WHEN s.st_grade = 'ชั้น1' THEN s.st_code END) AS grade_1_count,
      COUNT(DISTINCT CASE WHEN s.st_grade = 'ชั้น2' THEN s.st_code END) AS grade_2_count,
      COUNT(DISTINCT CASE WHEN s.st_grade = 'ชั้น3' THEN s.st_code END) AS grade_3_count,
      ROUND(AVG(s.st_point), 2) AS avg_point,
      ROUND(MAX(s.st_point), 2) AS max_point,
      ROUND(MIN(s.st_point), 2) AS min_point
    FROM tbl_strength s
    LEFT JOIN active_coop ac ON s.st_code = ac.c_code
    WHERE s.st_year = ?
    GROUP BY org_type
    ORDER BY FIELD(org_type, 'สหกรณ์ภาคการเกษตร', 'สหกรณ์นอกภาคการเกษตร', 'กลุ่มเกษตรกร')
  `, [year]);
  return rows;
};

const getGradeSummaryByInOutGroup = async (year) => {
  let sql = `
    SELECT 
      CASE 
        WHEN ac.coop_group = 'สหกรณ์' AND ac.in_out_group = 'ภาคการเกษตร' THEN 'สหกรณ์ภาคการเกษตร'
        WHEN ac.coop_group = 'สหกรณ์' THEN 'สหกรณ์นอกภาคการเกษตร'
        WHEN ac.coop_group = 'กลุ่มเกษตรกร' THEN 'กลุ่มเกษตรกร'
        WHEN ac.coop_group IS NOT NULL THEN ac.coop_group
        ELSE 'ไม่ระบุประเภท'
      END AS group_name,
      COUNT(*) AS total_count,
      SUM(CASE WHEN s.st_grade = 'ชั้น1' THEN 1 ELSE 0 END) AS grade_1_count,
      SUM(CASE WHEN s.st_grade = 'ชั้น2' THEN 1 ELSE 0 END) AS grade_2_count,
      SUM(CASE WHEN s.st_grade = 'ชั้น3' THEN 1 ELSE 0 END) AS grade_3_count
    FROM tbl_strength s
    LEFT JOIN active_coop ac ON s.st_code = ac.c_code
  `;
  const params = [];
  if (year) {
    sql += ` WHERE s.st_year = ?`;
    params.push(year);
  }
  sql += `
    GROUP BY group_name
    ORDER BY FIELD(group_name, 'สหกรณ์ภาคการเกษตร', 'สหกรณ์นอกภาคการเกษตร', 'กลุ่มเกษตรกร')
  `;
  const [rows] = await db.query(sql, params);
  return rows;
};

module.exports = {
  bulkUpsert: exports.bulkUpsert,
  getRecent: exports.getRecent,
  getGradeCounts: exports.getGradeCounts,
  getLatestYear: exports.getLatestYear,
  getDetailsByGroupAndYear: exports.getDetailsByGroupAndYear,
  getByCode: exports.getByCode,
  getInstitutionProfile: exports.getInstitutionProfile,
  getYears,
  getListByYearAndGroup,
  getSummaryByYear,
  getGradeSummaryByInOutGroup,
};
