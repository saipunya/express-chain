const db = require('../config/db');

exports.findByUser = async (m_user) => {
  const [rows] = await db.query('SELECT m_id FROM member3 WHERE m_user = ?', [m_user]);
  return rows[0];
};

exports.create = async (m) => {
  const sql = `
    INSERT INTO member3 (
      m_user, m_pass, m_group, m_name, m_position, m_head, m_usersystem,
      m_type, m_org, m_class, m_pic, m_status, m_img
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    m.m_user,
    m.m_pass,               // hashed
    m.m_group ?? '',        // enum: 'cpd','coop','group','' — ค่าเริ่มต้น ''
    m.m_name,
    m.m_position,
    m.m_head ?? '',
    m.m_usersystem ?? '',
    m.m_type ?? 'จ้างเหมาบริการ',
    m.m_org ?? '',
    m.m_class,              // มาจาก select “group” ในฟอร์ม
    m.m_pic ?? '',
    m.m_status ?? 'wait',
    m.m_img ?? ''
  ];
  const [result] = await db.query(sql, params);
  return result.insertId;
};