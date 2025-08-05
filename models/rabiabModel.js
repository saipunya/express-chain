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

// 3ระ3บ3้งหมดแบบแบ่งหน้า
exports.getAllRabiab = async (page = 1, search = '') => {
  const offset = (page - 1) * ITEMS_PER_PAGE;
  let whereClause = "WHERE tbl_rabiab.ra_status = 'active'";
  let params = [];

  if (search) {
    whereClause += " AND (tbl_rabiab.ra_name LIKE ? OR active_coop.c_name LIKE ? OR tbl_rabiab.ra_year LIKE ?)";
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm, searchTerm];
  }

  const [rows] = await db.query(`
    SELECT * FROM tbl_rabiab LEFT JOIN active_coop ON tbl_rabiab.ra_code = active_coop.c_code
    ${whereClause}
    ORDER BY tbl_rabiab.ra_id DESC
    LIMIT ? OFFSET ?
  `, [...params, ITEMS_PER_PAGE, offset]);

  return rows;
};

// 3จำนวนระ3บ3้งหมด
exports.countRabiab = async (search = '') => {
  let whereClause = "WHERE tbl_rabiab.ra_status = 'active'";
  let params = [];

  if (search) {
    whereClause += " AND (tbl_rabiab.ra_name LIKE ? OR active_coop.c_name LIKE ? OR tbl_rabiab.ra_year LIKE ?)";
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm, searchTerm];
  }

  const [rows] = await db.query(`
    SELECT COUNT(*) as total FROM tbl_rabiab LEFT JOIN active_coop ON tbl_rabiab.ra_code = active_coop.c_code
    ${whereClause}
  `, params);
  
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
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_status = "1"');
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
      'SELECT c_code, c_name FROM active_coop WHERE c_status = "1" AND c_group = ? ORDER BY c_name',
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
