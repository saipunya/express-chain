const db = require('../config/db'); // Assume a database connection module

exports.getAllMembers = async () => {
  try {
    const [rows] = await db.query('SELECT * FROM member3 ORDER BY m_class ASC'); // Destructure rows
  
    return rows; // Return rows instead of the entire result
  } catch (error) {
    console.error('Error fetching members:', error); // Log the error
    throw error; // Rethrow the error to be handled by the controller
  }
};

exports.getMemberById = async (id) => {
  const [rows] = await db.query('SELECT * FROM member3 WHERE m_id = ?', [id]);
  return rows.length > 0 ? rows[0] : null; // Return the first row or null if not found
};

exports.addMember = async (member) => {
  const { username, fullname, position, group, m_class } = member;
  return db.query(
    'INSERT INTO member3 (m_user, m_name, m_position, `m_group`, m_class) VALUES (?, ?, ?, ?, ?)',
    [username, fullname, position, group, m_class]
  );
};

exports.updateMember = async (id, member) => {
  const { username, fullname, position, group, m_class } = member;
  return db.query(
    'UPDATE member3 SET m_user = ?, m_name = ?, m_position = ?, `m_group` = ?, m_class = ? WHERE m_id = ?',
    [username, fullname, position, group, m_class, id]
  );
};

exports.updateMemberStatus = async (id, status) => {
  return db.query('UPDATE member3 SET m_status = ? WHERE m_id = ?', [status, id]);
};

exports.deleteMember = async (id) => {
  return db.query('DELETE FROM member3 WHERE m_id = ?', [id]);
};
