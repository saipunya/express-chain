const db = require('../config/db');

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

exports.getSummaryByFiscalYear = async () => {
  const [rows] = await db.query(
    `SELECT
        CASE
          WHEN tur_month IN ('กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม')
            THEN CAST(NULLIF(tur_year, '') AS SIGNED) + 1
          ELSE CAST(NULLIF(tur_year, '') AS SIGNED)
        END AS fiscal_year,
        COUNT(*) AS coop_count,
        SUM(tur_amount) AS total_amount
     FROM tbl_turnover
     GROUP BY fiscal_year
     ORDER BY fiscal_year DESC`
  );
  return rows || [];
};

exports.getCoopMonthlySummary = async (coopCode) => {
  const [rows] = await db.query(
    `SELECT t.tur_year, t.tur_month, SUM(t.tur_amount) AS total_amount
     FROM tbl_turnover t
     JOIN active_coop ac ON ac.c_code = t.tur_code
     WHERE ac.c_code = ?
     GROUP BY t.tur_year, t.tur_month
     ORDER BY
       CAST(NULLIF(t.tur_year, '') AS SIGNED) DESC,
       FIELD(t.tur_month,
         'กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
         'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน',
         'พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม',
         '1','2','3','4','5','6','7','8','9','10','11','12'
       ) ASC`,
    [coopCode]
  );
  return rows || [];
};

exports.getCoopYearlySummary = async (coopCode) => {
  const [rows] = await db.query(
    `SELECT t.tur_year, SUM(t.tur_amount) AS total_amount
     FROM tbl_turnover t
     JOIN active_coop ac ON ac.c_code = t.tur_code
     WHERE ac.c_code = ?
     GROUP BY t.tur_year
     ORDER BY CAST(NULLIF(t.tur_year, '') AS SIGNED) DESC`,
    [coopCode]
  );
  return rows || [];
};

exports.bulkInsert = async (rows = [], batchSize = 200) => {
  if (!rows.length) return { inserted: 0 };

  const fields = ['tur_code', 'tur_name', 'tur_year', 'tur_month', 'tur_amount', 'tur_saveby', 'tur_savedate'];
  let totalInserted = 0;

  for (const batch of chunk(rows, batchSize)) {
    const values = batch.map((r) => fields.map((f) => r[f]));
    const placeholders = values.map(() => '(' + fields.map(() => '?').join(',') + ')').join(',');
    const sql = `INSERT INTO tbl_turnover (${fields.join(',')}) VALUES ${placeholders}`;
    const [result] = await db.query(sql, values.flat());
    totalInserted += result.affectedRows || 0;
  }

  return { inserted: totalInserted };
};

exports.getRecent = async (limit = 100) => {
  const [rows] = await db.query(
    'SELECT * FROM tbl_turnover ORDER BY tur_id DESC LIMIT ?',
    [limit]
  );
  return rows;
};

exports.getExistingKeys = async (keys = []) => {
  if (!keys.length) return new Set();
  const placeholders = keys.map(() => '(?, ?, ?)').join(',');
  const flat = keys.flat();
  const [rows] = await db.query(
    `SELECT tur_code, tur_year, tur_month
     FROM tbl_turnover
     WHERE (tur_code, tur_year, tur_month) IN (${placeholders})`,
    flat
  );
  const set = new Set();
  (rows || []).forEach((r) => {
    set.add(`${r.tur_code}__${r.tur_year}__${r.tur_month}`);
  });
  return set;
};

exports.getSummaryByMonthYear = async () => {
  const [rows] = await db.query(
    `SELECT tur_year, tur_month,
            COUNT(*) AS coop_count,
            SUM(tur_amount) AS total_amount
     FROM tbl_turnover
     GROUP BY tur_year, tur_month
     ORDER BY
       CASE
         WHEN tur_month IN ('กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม')
           THEN CAST(NULLIF(tur_year, '') AS SIGNED)
         ELSE CAST(NULLIF(tur_year, '') AS SIGNED) - 1
       END DESC,
       FIELD(tur_month,
         'กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
         'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน',
         'พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม'
       ) ASC`
  );
  return rows || [];
};
