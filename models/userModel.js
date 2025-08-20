const db = require('../config/db');

exports.createUser = async (userData) => {
  const {
    username,
    password,
    group,
    fullname,
    position
  } = userData;

  const sql = `
    INSERT INTO member3 (
      m_user, m_pass, m_group, m_name, m_position,
      m_type, m_class, m_status, m_img
    )
    VALUES (?, ?, ?, ?, ?, 'user', 'user', 'active', 'default.png')
  `;

  await db.execute(sql, [
    username,
    password,
    group,
    fullname,
    position
  ]);
};

exports.findUserByUsername = async (username) => {
  try {
    const [rows] = await db.query('SELECT * FROM member3 WHERE m_user = ? AND m_status = "active"', [username]);
    return rows[0];
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
};
exports.test = async () => {
  try {
    const [rows] = await db.query('SELECT * FROM member3');
    return rows;
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
};