const db = require('../config/db');

exports.createUser = async (userData) => {
  const {
    username,
    hashedPassword,
    group,
    fullname,
    position,
    type,
    userClass,
    status,
    img
   
  } = userData;

  const sql = `
    INSERT INTO member2 (
      m_user, m_pass, m_group, m_name, m_position, m_type, m_class,
      m_status, m_img
    )
    VALUES (?, ?, ? ,?, ?, ?, 'user', 'active', 'default.png')
  `;

  await db.execute(sql, [
    username,
    hashedPassword,
    group,
    fullname,
    position,
    type,
    userClass,
    status,
    img
  ]);
};

exports.findUserByUsername = async (username) => {
    try {
      const [rows] = await db.query('SELECT * FROM member2 WHERE m_user = ?', [username]);
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