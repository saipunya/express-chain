const db = require('../config/db');

// Get all meeting room bookings
exports.getAll = async () => {
  const [rows] = await db.query(
    'SELECT * FROM tbl_meetingroom WHERE mee_date >= NOW() ORDER BY mee_date DESC, mee_id DESC'
  );
  return rows;
};

// Get a booking by id
exports.getById = async (id) => {
  const [rows] = await db.query(
    'SELECT * FROM tbl_meetingroom WHERE mee_date >= NOW() AND mee_id = ?',
    [id]
  );
  return rows.length ? rows[0] : null;
};

// Create a new booking
exports.create = async (data) => {
  const { mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate } = data;
  const sql = `INSERT INTO tbl_meetingroom (mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate];
  const [result] = await db.query(sql, params);
  return result.insertId;
};

// Update a booking
exports.update = async (id, data) => {
  const { mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate } = data;
  const sql = `UPDATE tbl_meetingroom
               SET mee_date = ?, mee_time = ?, mee_subject = ?, mee_room = ?, mee_respon = ?, mee_saveby = ?, mee_savedate = ?
               WHERE mee_id = ?`;
  const params = [mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate, id];
  const [result] = await db.query(sql, params);
  return result.affectedRows;
};

// Delete a booking
exports.remove = async (id) => {
  const [result] = await db.query('DELETE FROM tbl_meetingroom WHERE mee_id = ?', [id]);
  return result.affectedRows;
};
