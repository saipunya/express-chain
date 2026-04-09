const db = require('../config/db');

async function listAll() {
  const [rows] = await db.query(
    `SELECT dm.*, m.m_name AS member_name, m.m_position AS member_position
     FROM driver_masters dm
     LEFT JOIN member3 m ON m.m_id = dm.member_id
     ORDER BY CASE dm.status WHEN 'active' THEN 1 ELSE 2 END,
              dm.driver_name ASC`
  );
  return rows;
}

async function listActive() {
  const [rows] = await db.query(
    `SELECT *
     FROM driver_masters
     WHERE status = 'active'
     ORDER BY driver_name ASC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM driver_masters WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(payload) {
  const [result] = await db.query(
    `INSERT INTO driver_masters (
      member_id, driver_name, driver_position, license_no, phone,
      status, notes, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.member_id || null,
      payload.driver_name,
      payload.driver_position || null,
      payload.license_no || null,
      payload.phone || null,
      payload.status || 'active',
      payload.notes || null,
      payload.created_by || null,
      payload.updated_by || null
    ]
  );
  return result.insertId;
}

async function update(id, payload) {
  await db.query(
    `UPDATE driver_masters
     SET member_id = ?,
         driver_name = ?,
         driver_position = ?,
         license_no = ?,
         phone = ?,
         status = ?,
         notes = ?,
         updated_by = ?
     WHERE id = ?`,
    [
      payload.member_id || null,
      payload.driver_name,
      payload.driver_position || null,
      payload.license_no || null,
      payload.phone || null,
      payload.status || 'active',
      payload.notes || null,
      payload.updated_by || null,
      id
    ]
  );
}

module.exports = {
  create,
  getById,
  listAll,
  listActive
  ,update
};