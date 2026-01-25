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
    const [rows] = await db.query(
      'SELECT * FROM member3 WHERE m_user = ? AND m_status = "active"',
      [username]
    );
    
    return rows[0];
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
};

exports.findActiveUsers = async () => {
  const [rows] = await db.query(
    `SELECT m_id, m_user, m_name, m_position, m_class
     FROM member3
     WHERE m_status = 'active'
     ORDER BY m_name ASC`
  );
  return rows;
};

exports.findActiveUserById = async (id) => {
  const [rows] = await db.query(
    `SELECT m_id, m_user, m_name, m_position, m_class
     FROM member3
     WHERE m_id = ? AND m_status = 'active'
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

exports.findDistinctClasses = async () => {
  const [rows] = await db.query(
    `SELECT DISTINCT TRIM(m_class) AS m_class
     FROM member3
     WHERE m_class IS NOT NULL AND TRIM(m_class) <> ''
     ORDER BY TRIM(m_class) ASC`
  );
  return rows.map((r) => r.m_class).filter(Boolean);
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