const db = require('../config/db');

function mapPayload(payload) {
  return {
    travel_request_id: payload.travel_request_id,
    vehicle_request_no: payload.vehicle_request_no,
    request_date: payload.request_date,
    learn_to: payload.learn_to || null,
    requester_member_id: payload.requester_member_id || null,
    requester_name: payload.requester_name,
    requester_position: payload.requester_position || null,
    destination_text: payload.destination_text,
    mission_text: payload.mission_text,
    passenger_count: payload.passenger_count || 1,
    trip_start_at: payload.trip_start_at,
    trip_end_at: payload.trip_end_at,
    status: payload.status || 'draft',
    submitted_at: payload.submitted_at || null,
    approved_at: payload.approved_at || null,
    rejected_at: payload.rejected_at || null,
    cancelled_at: payload.cancelled_at || null,
    completed_at: payload.completed_at || null,
    approver_member_id: payload.approver_member_id || null,
    approver_name: payload.approver_name || null,
    approver_position: payload.approver_position || null,
    approval_comment: payload.approval_comment || null,
    created_by: payload.created_by || null,
    updated_by: payload.updated_by || null
  };
}

async function listAll() {
  const [rows] = await db.query(`
    SELECT vr.*, tr.request_no AS travel_request_no, tr.subject AS travel_subject,
           va.plate_no_snapshot, va.driver_name_snapshot, vtl.log_status
    FROM vehicle_requests vr
    INNER JOIN official_travel_requests tr ON tr.id = vr.travel_request_id
    LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
    LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
    ORDER BY vr.request_date DESC, vr.id DESC
  `);
  return rows;
}

async function listReport(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.dateFrom) {
    conditions.push('DATE(vr.trip_start_at) >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('DATE(vr.trip_start_at) <= ?');
    params.push(filters.dateTo);
  }

  if (filters.status) {
    conditions.push('vr.status = ?');
    params.push(filters.status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT vr.*, tr.request_no AS travel_request_no, tr.subject AS travel_subject,
            tr.requester_group AS travel_requester_group,
            va.plate_no_snapshot, va.driver_name_snapshot,
            vtl.morning_departure_at, vtl.morning_odometer,
            vtl.afternoon_return_at, vtl.afternoon_odometer,
            vtl.distance_km, vtl.log_status
     FROM vehicle_requests vr
     INNER JOIN official_travel_requests tr ON tr.id = vr.travel_request_id
     LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
     LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
     ${whereClause}
     ORDER BY vr.trip_start_at DESC, vr.id DESC`,
    params
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM vehicle_requests WHERE id = ?', [id]);
  return rows[0] || null;
}

async function getByTravelRequestId(travelRequestId) {
  const [rows] = await db.query(
    'SELECT * FROM vehicle_requests WHERE travel_request_id = ? ORDER BY id DESC LIMIT 1',
    [travelRequestId]
  );
  return rows[0] || null;
}

async function getDetailById(id) {
  const [rows] = await db.query(`
    SELECT vr.*, tr.request_no AS travel_request_no, tr.subject AS travel_subject,
           tr.status AS travel_status,
           tr.destination_text AS travel_destination, tr.start_at AS travel_start_at, tr.end_at AS travel_end_at,
           va.vehicle_id, va.driver_id, va.plate_no_snapshot, va.driver_name_snapshot,
           vtl.morning_departure_at, vtl.morning_odometer, vtl.afternoon_return_at, vtl.afternoon_odometer,
           vtl.distance_km, vtl.log_status
    FROM vehicle_requests vr
    INNER JOIN official_travel_requests tr ON tr.id = vr.travel_request_id
    LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
    LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
    WHERE vr.id = ?
  `, [id]);
  return rows[0] || null;
}

async function create(payload) {
  const data = mapPayload(payload);
  const [result] = await db.query(
    `INSERT INTO vehicle_requests (
      travel_request_id, vehicle_request_no, request_date, learn_to, requester_member_id,
      requester_name, requester_position, destination_text, mission_text, passenger_count,
      trip_start_at, trip_end_at, status, submitted_at, approved_at, rejected_at,
      cancelled_at, completed_at, approver_member_id, approver_name, approver_position,
      approval_comment, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.travel_request_id, data.vehicle_request_no, data.request_date, data.learn_to, data.requester_member_id,
      data.requester_name, data.requester_position, data.destination_text, data.mission_text, data.passenger_count,
      data.trip_start_at, data.trip_end_at, data.status, data.submitted_at, data.approved_at, data.rejected_at,
      data.cancelled_at, data.completed_at, data.approver_member_id, data.approver_name, data.approver_position,
      data.approval_comment, data.created_by, data.updated_by
    ]
  );
  return result.insertId;
}

async function update(id, payload) {
  const data = mapPayload(payload);
  await db.query(
    `UPDATE vehicle_requests SET
      travel_request_id = ?,
      request_date = ?,
      learn_to = ?,
      requester_member_id = ?,
      requester_name = ?,
      requester_position = ?,
      destination_text = ?,
      mission_text = ?,
      passenger_count = ?,
      trip_start_at = ?,
      trip_end_at = ?,
      status = ?,
      submitted_at = ?,
      approved_at = ?,
      rejected_at = ?,
      cancelled_at = ?,
      completed_at = ?,
      approver_member_id = ?,
      approver_name = ?,
      approver_position = ?,
      approval_comment = ?,
      updated_by = ?
    WHERE id = ?`,
    [
      data.travel_request_id,
      data.request_date,
      data.learn_to,
      data.requester_member_id,
      data.requester_name,
      data.requester_position,
      data.destination_text,
      data.mission_text,
      data.passenger_count,
      data.trip_start_at,
      data.trip_end_at,
      data.status,
      data.submitted_at,
      data.approved_at,
      data.rejected_at,
      data.cancelled_at,
      data.completed_at,
      data.approver_member_id,
      data.approver_name,
      data.approver_position,
      data.approval_comment,
      data.updated_by,
      id
    ]
  );
}

async function submit(id, user) {
  await db.query(
    `UPDATE vehicle_requests
     SET status = 'submitted', submitted_at = NOW(), updated_by = ?
     WHERE id = ? AND status = 'draft'`,
    [user?.fullname || user?.username || 'system', id]
  );
}

async function listPendingApproval() {
  const [rows] = await db.query(`
    SELECT vr.*, tr.request_no AS travel_request_no, tr.subject AS travel_subject,
           tr.status AS travel_status, tr.requester_group AS travel_requester_group,
           va.plate_no_snapshot, va.driver_name_snapshot
    FROM vehicle_requests vr
    INNER JOIN official_travel_requests tr ON tr.id = vr.travel_request_id
    LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
    WHERE vr.status IN ('submitted', 'approved')
    ORDER BY vr.submitted_at ASC, vr.id ASC
  `);
  return rows;
}

async function approve(id, user, approvalComment = null) {
  await db.query(
    `UPDATE vehicle_requests
     SET status = 'approved',
         approved_at = NOW(),
         approver_member_id = ?,
         approver_name = ?,
         approver_position = ?,
         approval_comment = ?,
         updated_by = ?
     WHERE id = ? AND status = 'submitted'`,
    [
      user?.id || null,
      user?.fullname || null,
      user?.position || null,
      approvalComment || null,
      user?.fullname || user?.username || 'system',
      id
    ]
  );
}

async function forceApprove(id, user, approvalComment = null) {
  await db.query(
    `UPDATE vehicle_requests
     SET status = 'approved',
         approved_at = NOW(),
         approver_member_id = ?,
         approver_name = ?,
         approver_position = ?,
         approval_comment = ?,
         updated_by = ?
     WHERE id = ?`,
    [
      user?.id || null,
      user?.fullname || null,
      user?.position || null,
      approvalComment || null,
      user?.fullname || user?.username || 'system',
      id
    ]
  );
}

async function reject(id, user, approvalComment = null) {
  await db.query(
    `UPDATE vehicle_requests
     SET status = 'rejected',
         rejected_at = NOW(),
         approver_member_id = ?,
         approver_name = ?,
         approver_position = ?,
         approval_comment = ?,
         updated_by = ?
     WHERE id = ? AND status IN ('submitted', 'approved')`,
    [
      user?.id || null,
      user?.fullname || null,
      user?.position || null,
      approvalComment || null,
      user?.fullname || user?.username || 'system',
      id
    ]
  );
}

module.exports = {
  approve,
  create,
  getById,
  getByTravelRequestId,
  getDetailById,
  listAll,
  listReport,
  listPendingApproval,
  reject,
  submit,
  update,
  forceApprove
};
