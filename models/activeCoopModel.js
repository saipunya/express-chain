const pool = require('../config/db');

exports.getAll = async (search, group, status, limit, offset) => {
  let sql = `SELECT * FROM active_coop WHERE 1 `;
  let params = [];

  if (search) {
    sql += `AND (c_name LIKE ? OR c_code LIKE ? OR c_no LIKE ?) `;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (group && group !== 'all') {
    sql += `AND c_group = ? `;
    params.push(group);
  }

  if (status && status !== 'all') {
    sql += `AND c_status = ? `;
    params.push(status);
  }

  sql += `ORDER BY c_id DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const [rows] = await pool.query(sql, params);
  return rows;
};

exports.countAll = async (search, group, status) => {
  let sql = `SELECT COUNT(*) as total FROM active_coop WHERE 1 `;
  let params = [];

  if (search) {
    sql += `AND (c_name LIKE ? OR c_code LIKE ? OR c_no LIKE ?) `;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (group && group !== 'all') {
    sql += `AND c_group = ? `;
    params.push(group);
  }

  if (status && status !== 'all') {
    sql += `AND c_status = ? `;
    params.push(status);
  }

  const [rows] = await pool.query(sql, params);
  return rows[0].total;
};

exports.getById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM active_coop WHERE c_id = ?', [id]);
  return rows[0];
};

exports.create = async (data) => {
  const sql = `
    INSERT INTO active_coop (
      c_code, c_name, c_no, end_date, end_day, c_status, c_group,
      c_person, c_person2, coop_group, in_out_group, c_type,
      c_saveby, c_savedate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    data.c_code, data.c_name, data.c_no, data.end_date, data.end_day,
    data.c_status, data.c_group, data.c_person, data.c_person2,
    data.coop_group, data.in_out_group, data.c_type,
    data.c_saveby, data.c_savedate
  ];
  const [result] = await pool.query(sql, params);
  return result.insertId;
};

exports.update = async (id, data) => {
  const sql = `
    UPDATE active_coop SET
      c_code=?, c_name=?, c_no=?, end_date=?, end_day=?, c_status=?, c_group=?,
      c_person=?, c_person2=?, coop_group=?, in_out_group=?, c_type=?,
      c_saveby=?, c_savedate=?
    WHERE c_id=?
  `;
  const params = [
    data.c_code, data.c_name, data.c_no, data.end_date, data.end_day,
    data.c_status, data.c_group, data.c_person, data.c_person2,
    data.coop_group, data.in_out_group, data.c_type,
    data.c_saveby, data.c_savedate, id
  ];
  await pool.query(sql, params);
};

exports.remove = async (id) => {
  await pool.query('DELETE FROM active_coop WHERE c_id = ?', [id]);
};

// Simple list for selects
exports.getAllSimple = async () => {
  const [rows] = await pool.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name ASC');
  return rows;
};

exports.getByCode = async (code) => {
  const [rows] = await pool.query('SELECT c_code, c_name FROM active_coop WHERE c_code = ? LIMIT 1', [code]);
  return rows[0];
};

exports.getGroups = async () => {
  const [rows] = await pool.query('SELECT DISTINCT c_group FROM active_coop WHERE c_group IS NOT NULL AND c_group<>"" ORDER BY c_group ASC');
  return rows.map(r => r.c_group);
};

exports.getByGroup = async (group) => {
  const [rows] = await pool.query('SELECT c_code, c_name FROM active_coop WHERE c_group = ? ORDER BY c_name ASC', [group]);
  return rows;
};

exports.getClosedCoops = async () => {
  const [rows] = await pool.query(
    "SELECT * FROM active_coop WHERE c_status IN ('เลิก', 'เลิก/ชำระบัญชี') ORDER BY coop_group DESC , c_name ASC"
  );
  return rows;
};

exports.getGroupStats = async () => {
  // ดึงข้อมูลจำนวนสหกรณ์และกลุ่มเกษตรกรในแต่ละ c_group
  const [rows] = await pool.query(`
    SELECT 
      c_group,
      SUM(CASE WHEN coop_group = 'สหกรณ์' THEN 1 ELSE 0 END) AS coop,
      SUM(CASE WHEN coop_group = 'กลุ่มเกษตรกร' THEN 1 ELSE 0 END) AS farmer
    FROM active_coop WHERE c_status = 'ดำเนินการ'
    GROUP BY c_group
    ORDER BY c_group
  `);
  console.log('Group stats:', rows);
  return rows;
};

exports.getAllGroupedByEndDate = async () => {
  const [rows] = await pool.query(`
    SELECT 
      c_id,
      c_code,
      c_name,
      c_group,
      coop_group,
      c_status,
      DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date_fmt,
      YEAR(end_date) AS end_year,
      end_date
    FROM active_coop
    WHERE end_date IS NOT NULL AND c_status = 'ดำเนินการ'
    ORDER BY end_date DESC, c_name ASC
  `);
  return rows.reduce((acc, r) => {
    const key = r.end_year || 'ไม่ระบุปี';
    (acc[key] ||= []).push(r);
    return acc;
  }, {});
};

