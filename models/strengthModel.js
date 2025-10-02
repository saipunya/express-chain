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
