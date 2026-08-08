const db = require('../config/db');

const ITEMS_PER_PAGE = 20;

exports.ITEMS_PER_PAGE = ITEMS_PER_PAGE;

// สร้างระ<|im_start|>บใหม่
exports.insertRabiab = async (data) => {
  const {
    ra_code, ra_name, ra_year, ra_approvedate, ra_filename, ra_saveby, ra_savedate
  } = data;

  const [result] = await db.query(
    `INSERT INTO tbl_rabiab (ra_code, ra_name, ra_year, ra_approvedate, ra_status, ra_filename, ra_saveby, ra_savedate)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    [ra_code, ra_name, ra_year, ra_approvedate, ra_filename, ra_saveby, ra_savedate]
  );

  return result.insertId;
};

const buildSearchFilter = (search = '') => {
  const keyword = String(search).trim();
  if (!keyword) {
    return { clause: '', params: [] };
  }

  const searchableColumns = [
    'tbl_rabiab.ra_code',
    'tbl_rabiab.ra_name',
    'tbl_rabiab.ra_year',
    'tbl_rabiab.ra_approvedate',
    'tbl_rabiab.ra_filename',
    'tbl_rabiab.ra_saveby',
    'tbl_rabiab.ra_savedate',
    'active_coop.c_name',
    'active_coop.c_group'
  ];
  const pattern = `%${keyword}%`;

  return {
    clause: ` AND (${searchableColumns.map(column => `CAST(${column} AS CHAR) LIKE ?`).join(' OR ')})`,
    params: searchableColumns.map(() => pattern)
  };
};

// ดึงรายการทั้งหมด โดยไม่จำกัดจำนวนแถวเมื่อเป็นผลการค้นหา
exports.getAllRabiab = async (page = 1, search = '') => {
  const offset = (page - 1) * ITEMS_PER_PAGE;
  const searchFilter = buildSearchFilter(search);
  const whereClause = `WHERE tbl_rabiab.ra_status = 'active'${searchFilter.clause}`;
  const paginationClause = String(search).trim() ? '' : 'LIMIT ? OFFSET ?';
  const params = String(search).trim()
    ? searchFilter.params
    : [...searchFilter.params, ITEMS_PER_PAGE, offset];

  const [rows] = await db.query(`
    SELECT * FROM tbl_rabiab LEFT JOIN active_coop ON tbl_rabiab.ra_code = active_coop.c_code
    ${whereClause}
    ORDER BY tbl_rabiab.ra_id DESC
    ${paginationClause}
  `, params);

  return rows;
};

// 3จำนวนระ3บ3้งหมด
exports.countRabiab = async (search = '') => {
  const searchFilter = buildSearchFilter(search);
  const whereClause = `WHERE tbl_rabiab.ra_status = 'active'${searchFilter.clause}`;

  const [rows] = await db.query(`
    SELECT COUNT(*) as total FROM tbl_rabiab LEFT JOIN active_coop ON tbl_rabiab.ra_code = active_coop.c_code
    ${whereClause}
  `, searchFilter.params);

  return rows[0].total;
};

// 3ระ3บตาม ID
exports.getRabiabById = async (id) => {
  const [rows] = await db.query('SELECT * FROM tbl_rabiab WHERE ra_id = ?', [id]);
  return rows[0];
};

// 3ปเดตระ3บ
exports.updateRabiab = async (id, data) => {
  const {
    ra_code, ra_name, ra_year, ra_approvedate, ra_filename, ra_saveby, ra_savedate
  } = data;

  await db.query(
    `UPDATE tbl_rabiab 
     SET ra_code = ?, ra_name = ?, ra_year = ?, ra_approvedate = ?, ra_filename = ?, ra_saveby = ?, ra_savedate = ?
     WHERE ra_id = ?`,
    [ra_code, ra_name, ra_year, ra_approvedate, ra_filename, ra_saveby, ra_savedate, id]
  );
};

// ลบระ3บ (soft delete)
exports.deleteRabiab = async (id) => {
  await db.query('UPDATE tbl_rabiab SET ra_status = "inactive" WHERE ra_id = ?', [id]);
};

// 3ชื่อไฟล์ตาม ID
exports.getFilenameById = async (id) => {
  const [rows] = await db.query('SELECT ra_filename FROM tbl_rabiab WHERE ra_id = ?', [id]);
  return rows[0]?.ra_filename;
};

// 3รายการสหกรณ์
exports.coopAll = async () => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_status = "ดำเนินการ"');
  return rows;
};

exports.getCoopByCode = async (code) => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_code = ?', [code]);
  return rows[0];
};

// เantha function ี่สหกรณ์ตามกลุ่ม
exports.getCoopsByGroup = async (group) => {
  try {
    const [rows] = await db.query(
      'SELECT c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" AND c_group = ? ORDER BY c_name',
      [group]
    );
    return rows;
  } catch (error) {
    console.error('Database error in getCoopsByGroup:', error);
    throw error;
  }
};
// get tbl_rabiab join active_coop
exports.getRabiabWithCoop = async () => {
  const [rows] = await db.query(`
    SELECT tbl_rabiab.ra_id, tbl_rabiab.ra_code, tbl_rabiab.ra_name, tbl_rabiab.ra_year, tbl_rabiab.ra_approvedate, tbl_rabiab.ra_saveby, tbl_rabiab.ra_savedate ,active_coop.c_code,active_coop.c_name , active_coop.c_group
    FROM tbl_rabiab LEFT JOIN active_coop ON tbl_rabiab.ra_code = active_coop.c_code
    WHERE tbl_rabiab.ra_status = 'active'
    ORDER BY tbl_rabiab.ra_id DESC
  `);
  return rows;
};
exports.getLastUploads = async (limit = 10) => {
  const [rows] = await db.query(`
    SELECT tbl_rabiab.ra_id, tbl_rabiab.ra_name, tbl_rabiab.ra_year, tbl_rabiab.ra_saveby, tbl_rabiab.ra_savedate, active_coop.c_name
    FROM tbl_rabiab 
    LEFT JOIN active_coop ON tbl_rabiab.ra_code = active_coop.c_code
    WHERE tbl_rabiab.ra_status = 'active'
    ORDER BY tbl_rabiab.ra_id DESC
    LIMIT ?
  `, [limit]);
  return rows;
};
