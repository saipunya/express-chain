const db = require('../config/db');

// Auto-detect room column (mee_room preferred, fallback mee_city)
let ROOM_COL = 'mee_room';
(async () => {
  try {
    const [cols] = await db.query('SHOW COLUMNS FROM tbl_meetingroom');
    const hasMeeRoom = cols.some(c => c.Field === 'mee_room');
    const hasMeeCity = cols.some(c => c.Field === 'mee_city');
    if (!hasMeeRoom && hasMeeCity) ROOM_COL = 'mee_city';
  } catch (e) {
    console.error('Room column detection failed:', e);
  }
})();

// Get all meeting room bookings (include past)
exports.getAll = async () => {
  const [rows] = await db.query(
    `SELECT mee_id, mee_date, mee_time, mee_subject,
            COALESCE(mee_room, mee_city) AS mee_room,
            mee_respon, mee_saveby, mee_savedate
     FROM tbl_meetingroom
     ORDER BY mee_date DESC, mee_id DESC`
  );
  return rows;
};

// Get a booking by id (include past)
exports.getById = async (id) => {
  const [rows] = await db.query(
    `SELECT mee_id, mee_date, mee_time, mee_subject,
            COALESCE(mee_room, mee_city) AS mee_room,
            mee_respon, mee_saveby, mee_savedate
     FROM tbl_meetingroom
     WHERE mee_id = ?`,
    [id]
  );
  return rows.length ? rows[0] : null;
};

// Create a new booking (dynamic room column)
exports.create = async (data) => {
  const { mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate } = data;
  const sql = `INSERT INTO tbl_meetingroom (mee_date, mee_time, mee_subject, ${ROOM_COL}, mee_respon, mee_saveby, mee_savedate)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate];
  const [result] = await db.query(sql, params);
  return result.insertId;
};

// Update a booking (dynamic room column)
exports.update = async (id, data) => {
  const { mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate } = data;
  const sql = `UPDATE tbl_meetingroom
               SET mee_date = ?, mee_time = ?, mee_subject = ?, ${ROOM_COL} = ?, mee_respon = ?, mee_saveby = ?, mee_savedate = ?
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
