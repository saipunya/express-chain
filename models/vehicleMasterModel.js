const db = require('../config/db');

async function listAll() {
  const [rows] = await db.query(
    `SELECT *
     FROM vehicle_masters
     ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'maintenance' THEN 2 ELSE 3 END,
              plate_no ASC,
              vehicle_name ASC`
  );
  return rows;
}

async function listActive() {
  const [rows] = await db.query(
    `SELECT *
     FROM vehicle_masters
     WHERE status = 'active'
     ORDER BY plate_no ASC, vehicle_name ASC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM vehicle_masters WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(payload) {
  const [result] = await db.query(
    `INSERT INTO vehicle_masters (
      plate_no, vehicle_name, vehicle_type, brand, model, seat_capacity,
      status, notes, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.plate_no,
      payload.vehicle_name,
      payload.vehicle_type || null,
      payload.brand || null,
      payload.model || null,
      payload.seat_capacity || null,
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
    `UPDATE vehicle_masters
     SET plate_no = ?,
         vehicle_name = ?,
         vehicle_type = ?,
         brand = ?,
         model = ?,
         seat_capacity = ?,
         status = ?,
         notes = ?,
         updated_by = ?
     WHERE id = ?`,
    [
      payload.plate_no,
      payload.vehicle_name,
      payload.vehicle_type || null,
      payload.brand || null,
      payload.model || null,
      payload.seat_capacity || null,
      payload.status || 'active',
      payload.notes || null,
      payload.updated_by || null,
      id
    ]
  );
}

async function remove(id) {
  await db.query('DELETE FROM vehicle_masters WHERE id = ?', [id]);
}

module.exports = {
  create,
  getById,
  listAll,
  listActive,
  update,
  delete: remove
};