const db = require('../config/db');

// เพิ่มข้อมูล
exports.insert = async (data) => {
  const sql = `INSERT INTO tbl_gitgum (
    git_date, git_time, git_act, git_place, git_goto, git_respon, git_maihed,
    git_group, git_saveby, git_savedate
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = Object.values(data);
  await db.query(sql, params);
};

// ดึงข้อมูลทั้งหมด
exports.findAll = async () => {
  const [rows] = await db.query('SELECT * FROM tbl_gitgum ORDER BY git_date DESC');
  return rows;
};

// ดึงข้อมูลตาม ID
exports.findById = async (id) => {
  const [rows] = await db.query('SELECT * FROM tbl_gitgum WHERE git_id = ?', [id]);
  return rows[0];
};

// อัปเดตข้อมูล
exports.update = async (id, data) => {
  const sql = `UPDATE tbl_gitgum SET
    git_date = ?, git_time = ?, git_act = ?, git_place = ?, git_goto = ?, git_respon = ?,
    git_maihed = ?, git_group = ?, git_saveby = ?, git_savedate = ?
    WHERE git_id = ?`;
  const params = [...Object.values(data), id];
  await db.query(sql, params);
};

// ลบ
exports.delete = async (id) => {
  await db.query('DELETE FROM tbl_gitgum WHERE git_id = ?', [id]);
};

// หาเฉพาะกิจกรรมของวันนี้
exports.findToday = async () => {
  const [rows] = await db.query(`SELECT * FROM tbl_gitgum WHERE git_date = CURDATE()`);
  return rows;
};
exports.findByDate = (date) => {
    return pool.query('SELECT * FROM tbl_gitgum WHERE git_date = ?', [date]);
  };
