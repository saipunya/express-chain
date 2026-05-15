const db = require('../config/db');

function toSqlDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null;
  }
  return `${toSqlDate(dateValue)} ${timeValue}:00`;
}

async function listQueueForUser(user) {
  const [rows] = await db.query(
    `SELECT vr.id AS vehicle_request_id, vr.travel_request_id, vr.vehicle_request_no, vr.destination_text, vr.trip_start_at, vr.trip_end_at,
            vr.requester_name, vr.status, va.vehicle_id, va.driver_id, va.assignment_note,
            va.plate_no_snapshot, va.driver_name_snapshot,
            vtl.log_status, vtl.morning_departure_at, vtl.afternoon_return_at
     FROM vehicle_requests vr
     INNER JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
     LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
     WHERE (vr.status IN ('assigned', 'in_progress'))
        OR (vr.travel_request_id IS NULL AND vr.status = 'draft')
     ORDER BY vr.trip_start_at ASC, vr.id ASC`,
  );
  return rows;
}

async function listMonthlyReport({ driverId = null, month = null } = {}) {
  const conditions = [];
  const params = [];

  if (driverId) {
    conditions.push('va.driver_id = ?');
    params.push(driverId);
  }

  if (month) {
    conditions.push('DATE_FORMAT(vr.trip_start_at, "%Y-%m") = ?');
    params.push(month);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT vr.id AS vehicle_request_id, vr.travel_request_id, vr.vehicle_request_no, vr.destination_text, vr.mission_text,
            vr.trip_start_at, vr.trip_end_at, vr.requester_name, vr.status,
            va.driver_id, va.plate_no_snapshot, va.driver_name_snapshot,
            vtl.log_status, vtl.morning_departure_at, vtl.morning_odometer,
            vtl.afternoon_return_at, vtl.afternoon_odometer, vtl.distance_km
     FROM vehicle_requests vr
     INNER JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
     LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
     ${whereClause}
     ORDER BY vr.trip_start_at ASC, vr.id ASC`,
    params
  );

  return rows;
}

async function getDetailForUser(vehicleRequestId, user) {
  const [rows] = await db.query(
    `SELECT vr.id AS vehicle_request_id, vr.travel_request_id, vr.vehicle_request_no, vr.destination_text, vr.trip_start_at, vr.trip_end_at,
            vr.requester_name, vr.mission_text, vr.status,
            va.vehicle_id, va.driver_id, va.plate_no_snapshot, va.driver_name_snapshot,
            vtl.id AS trip_log_id, vtl.morning_departure_at, vtl.morning_odometer,
            vtl.afternoon_return_at, vtl.afternoon_odometer, vtl.distance_km, vtl.log_status, vtl.remarks
     FROM vehicle_requests vr
     INNER JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
     LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
     WHERE vr.id = ?
      LIMIT 1`,
    [vehicleRequestId]
  );

  return rows[0] || null;
}

async function logMorning(vehicleRequestId, user, departureTime, odometer) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [requestRows] = await connection.query(
      'SELECT trip_start_at FROM vehicle_requests WHERE id = ? LIMIT 1',
      [vehicleRequestId]
    );
    const departureAt = combineDateAndTime(requestRows[0]?.trip_start_at, departureTime);

    await connection.query(
      `UPDATE vehicle_trip_logs
       SET morning_departure_at = ?,
           morning_odometer = ?,
           logged_morning_by_member_id = ?,
           log_status = 'morning_logged'
       WHERE vehicle_request_id = ?
         AND morning_departure_at IS NULL`,
      [departureAt, odometer, user?.id || null, vehicleRequestId]
    );

    await connection.query(
      `UPDATE vehicle_requests
       SET status = 'in_progress', updated_by = ?
       WHERE id = ? AND status = 'assigned'`,
      [user?.fullname || user?.username || 'system', vehicleRequestId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function logAfternoon(vehicleRequestId, user, returnTime, odometer) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT vehicle_trip_logs.morning_odometer, vr.trip_end_at
       FROM vehicle_trip_logs
       INNER JOIN vehicle_requests vr ON vr.id = vehicle_trip_logs.vehicle_request_id
       WHERE vehicle_trip_logs.vehicle_request_id = ?
       LIMIT 1`,
      [vehicleRequestId]
    );

    const morningOdometer = rows[0]?.morning_odometer;
    if (morningOdometer == null) {
      throw new Error('MORNING_LOG_REQUIRED');
    }

    const distance = Number(odometer) - Number(morningOdometer);
    const returnAt = combineDateAndTime(rows[0]?.trip_end_at, returnTime);
    await connection.query(
      `UPDATE vehicle_trip_logs
       SET afternoon_return_at = ?,
           afternoon_odometer = ?,
           distance_km = ?,
           logged_afternoon_by_member_id = ?,
           log_status = 'completed'
       WHERE vehicle_request_id = ?
         AND afternoon_return_at IS NULL`,
      [returnAt, odometer, distance >= 0 ? distance : null, user?.id || null, vehicleRequestId]
    );

    await connection.query(
      `UPDATE vehicle_requests
       SET status = 'completed', completed_at = NOW(), updated_by = ?
       WHERE id = ? AND status IN ('assigned', 'in_progress')`,
      [user?.fullname || user?.username || 'system', vehicleRequestId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function normalizeOptionalOdometer(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    const error = new Error('INVALID_ODOMETER');
    error.code = 'INVALID_ODOMETER';
    throw error;
  }

  return numericValue;
}

async function updateMileage(vehicleRequestId, user, payload = {}) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[row]] = await connection.query(
      `SELECT
         vtl.morning_odometer,
         vtl.afternoon_odometer
       FROM vehicle_trip_logs vtl
       WHERE vtl.vehicle_request_id = ?
       LIMIT 1
       FOR UPDATE`,
      [vehicleRequestId]
    );

    if (!row) {
      const error = new Error('TRIP_LOG_NOT_FOUND');
      error.code = 'TRIP_LOG_NOT_FOUND';
      throw error;
    }

    const currentMorning = row.morning_odometer === null ? null : Number(row.morning_odometer);
    const currentAfternoon = row.afternoon_odometer === null ? null : Number(row.afternoon_odometer);
    const nextMorning = payload.morningOdometer === undefined
      ? currentMorning
      : normalizeOptionalOdometer(payload.morningOdometer);
    const nextAfternoon = payload.afternoonOdometer === undefined
      ? currentAfternoon
      : normalizeOptionalOdometer(payload.afternoonOdometer);

    let nextDistance = null;
    if (nextMorning !== null && nextAfternoon !== null) {
      const distance = Number(nextAfternoon) - Number(nextMorning);
      nextDistance = distance >= 0 ? distance : null;
    }

    const nextLogStatus = nextMorning !== null && nextAfternoon !== null
      ? 'completed'
      : nextMorning !== null
        ? 'morning_logged'
        : 'not_started';

    await connection.query(
      `UPDATE vehicle_trip_logs
       SET morning_odometer = ?,
           afternoon_odometer = ?,
           distance_km = ?,
           log_status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_request_id = ?`,
      [nextMorning, nextAfternoon, nextDistance, nextLogStatus, vehicleRequestId]
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
  getDetailForUser,
  listMonthlyReport,
  listQueueForUser,
  updateMileage,
  logAfternoon,
  logMorning
};
