const db = require('../config/db');

async function findOverlappingAssignment(vehicleId, startAt, endAt, excludedVehicleRequestId = null) {
  const params = [vehicleId, endAt, startAt];
  let excludedClause = '';
  if (excludedVehicleRequestId) {
    excludedClause = 'AND vr.id <> ?';
    params.push(excludedVehicleRequestId);
  }

  const [rows] = await db.query(
    `SELECT
       vr.id,
       vr.vehicle_request_no,
       vr.trip_start_at,
       vr.trip_end_at,
       va.plate_no_snapshot,
       va.driver_name_snapshot
     FROM vehicle_assignments va
     INNER JOIN vehicle_requests vr ON vr.id = va.vehicle_request_id
     WHERE va.vehicle_id = ?
       AND vr.status IN ('assigned', 'in_progress')
       AND vr.trip_start_at <= ?
       AND vr.trip_end_at >= ?
       ${excludedClause}
     ORDER BY vr.trip_start_at ASC
     LIMIT 1`,
    params
  );

  return rows[0] || null;
}

async function upsertAssignment(payload) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO vehicle_assignments (
        vehicle_request_id, vehicle_id, driver_id, assigned_by_member_id,
        assigned_at, assignment_note, plate_no_snapshot, driver_name_snapshot
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        vehicle_id = VALUES(vehicle_id),
        driver_id = VALUES(driver_id),
        assigned_by_member_id = VALUES(assigned_by_member_id),
        assigned_at = NOW(),
        assignment_note = VALUES(assignment_note),
        plate_no_snapshot = VALUES(plate_no_snapshot),
        driver_name_snapshot = VALUES(driver_name_snapshot)`,
      [
        payload.vehicle_request_id,
        payload.vehicle_id,
        payload.driver_id,
        payload.assigned_by_member_id || null,
        payload.assignment_note || null,
        payload.plate_no_snapshot,
        payload.driver_name_snapshot
      ]
    );

    await connection.query(
      `INSERT INTO vehicle_trip_logs (vehicle_request_id, log_status)
       VALUES (?, 'not_started')
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [payload.vehicle_request_id]
    );

    await connection.query(
      `UPDATE vehicle_requests
       SET status = 'assigned', updated_by = ?
       WHERE id = ?`,
      [payload.updated_by || null, payload.vehicle_request_id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  findOverlappingAssignment,
  upsertAssignment
};