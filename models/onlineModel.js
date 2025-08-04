const db = require('../config/db');

exports.getOnlineUsers = async () => {
  const [rows] = await db.query(`
    SELECT 
      o.on_memid,
      o.on_name,
      o.on_date,
      o.on_time,
      m.m_img,
      m.m_position
    FROM tbl_nowonline o
    LEFT JOIN member3 m ON o.on_memid = m.m_id
    WHERE o.on_time >= (UNIX_TIMESTAMP() - 900)
    ORDER BY o.on_time DESC
    LIMIT 10
  `);
  return rows;
};

exports.getOnlineCount = async () => {
  const [rows] = await db.query(`
    SELECT COUNT(*) as count 
    FROM tbl_nowonline 
    WHERE on_time >= (UNIX_TIMESTAMP() - 900)
  `);
  return rows[0].count;
};

// เริ่มใช้ออนไลน์และลบข้อมูลเก่า
exports.setUserOnline = async (userId, userName, sessionId) => {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp
  
  // ลบข้อมูลเก่าของ ้ใช้คน ้
  await db.query('DELETE FROM tbl_nowonline WHERE on_memid = ?', [userId]);
  
  // เริ่มข้อมูลใหม่
  await db.query(
    'INSERT INTO tbl_nowonline (on_memid, on_name, on_date, on_time, on_session) VALUES (?, ?, ?, ?, ?)',
    [userId, userName, currentDate, currentTime, sessionId]
  );
};

// ลบข้อมูลเก่าของ ้ใช้
exports.removeUserOnline = async (sessionId) => {
  await db.query('DELETE FROM tbl_nowonline WHERE on_session = ?', [sessionId]);
};

// ลบข้อมูลเก่าของ ้ใช้ตาม user ID
exports.removeUserOnlineById = async (userId) => {
  await db.query('DELETE FROM tbl_nowonline WHERE on_memid = ?', [userId]);
};

// ลบข้อมูลเก่า ้ใช้
exports.cleanupOldOnlineData = async () => {
  const fifteenMinutesAgo = Math.floor(Date.now() / 1000) - 900;
  await db.query('DELETE FROM tbl_nowonline WHERE on_time < ?', [fifteenMinutesAgo]);
};
