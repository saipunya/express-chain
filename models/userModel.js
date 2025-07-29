const db = require('../config/db');

exports.createUser = async (userData) => {
  const {
    username,
    fullname,
    position,
    group,
    email,
    hashedPassword
  } = userData;

  const sql = `
    INSERT INTO tbl_users (
      tbl_username, tbl_fullname, tbl_position, tbl_group, tbl_email,
      tbl_password, tbl_level, tbl_status
    )
    VALUES (?, ?, ? ,?, ?, ?, 'user', 'active')
  `;

  await db.execute(sql, [
    username,
    fullname,
    position,
    group,
    email,
    hashedPassword
  ]);
};

exports.findUserByUsername = async (username) => {
    try {
      const [rows] = await db.query('SELECT * FROM tbl_users WHERE tbl_username = ?', [username]);
      return rows[0]; // สมมุติมีแค่ 1 คน
    } catch (err) {
      console.error('Database error:', err);
      throw err;
    }
  };
  exports.test = async () => {
    try {
      const [rows] = await db.query('SELECT * FROM member2');
      return rows; // สมมุติมีแค่ 1 คน
    } catch (err) {
      console.error('Database error:', err);
      throw err;
    }
  }