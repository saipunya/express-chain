const db = require('../config/db');
const {
  ensureRunningNumberSettingsTable,
  generateRunningNumber
} = require('../services/runningNumberService');

function toBooleanFlag(value) {
  return value ? 1 : 0;
}

function normalizeCompanions(companions = []) {
  return companions
    .map((companion, index) => ({
      seq_no: index + 1,
      companion_member_id: companion.companion_member_id || null,
      companion_name: (companion.companion_name || '').trim(),
      companion_position: (companion.companion_position || '').trim() || null
    }))
    .filter((companion) => companion.companion_name);
}

async function upsertCompanions(connection, travelRequestId, companions) {
  await connection.query('DELETE FROM official_travel_companions WHERE travel_request_id = ?', [travelRequestId]);
  if (!companions.length) {
    return;
  }

  const values = companions.map((companion) => ([
    travelRequestId,
    companion.seq_no,
    companion.companion_member_id,
    companion.companion_name,
    companion.companion_position
  ]));

  await connection.query(
    `INSERT INTO official_travel_companions (
      travel_request_id, seq_no, companion_member_id, companion_name, companion_position
    ) VALUES ?`,
    [values]
  );
}

function mapPayload(payload) {
  return {
    request_no: payload.request_no,
    request_date: payload.request_date,
    subject: payload.subject,
    learn_to: payload.learn_to || null,
    requester_member_id: payload.requester_member_id || null,
    requester_name: payload.requester_name,
    requester_position: payload.requester_position || null,
    requester_group: payload.requester_group || null,
    purpose_text: payload.purpose_text,
    destination_text: payload.destination_text,
    start_at: payload.start_at,
    end_at: payload.end_at,
    duration_days: payload.duration_days || null,
    duration_hours: payload.duration_hours || null,
    transport_type: payload.transport_type,
    transport_other_text: payload.transport_other_text || null,
    out_of_province: toBooleanFlag(payload.out_of_province),
    requires_vehicle_request: toBooleanFlag(payload.requires_vehicle_request),
    status: payload.status || 'draft',
    submitted_at: payload.submitted_at || null,
    approved_at: payload.approved_at || null,
    rejected_at: payload.rejected_at || null,
    cancelled_at: payload.cancelled_at || null,
    approver_member_id: payload.approver_member_id || null,
    approver_name: payload.approver_name || null,
    approver_position: payload.approver_position || null,
    approval_comment: payload.approval_comment || null,
    created_by: payload.created_by || null,
    updated_by: payload.updated_by || null
  };
}

async function listAll(options = {}) {
  const params = [];
  const conditions = [];

  if (options.requesterMemberId) {
    conditions.push('tr.requester_member_id = ?');
    params.push(options.requesterMemberId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(`
    SELECT tr.*, COALESCE(tc.companion_count, 0) AS companion_count,
           vr.id AS vehicle_request_id, vr.vehicle_request_no, vr.status AS vehicle_request_status
    FROM official_travel_requests tr
    LEFT JOIN (
      SELECT travel_request_id, COUNT(*) AS companion_count
      FROM official_travel_companions
      GROUP BY travel_request_id
    ) tc ON tc.travel_request_id = tr.id
    LEFT JOIN vehicle_requests vr ON vr.travel_request_id = tr.id
    ${whereClause}
    ORDER BY tr.request_date DESC, tr.id DESC
  `, params);
  return rows;
}

async function listReport(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.dateFrom) {
    conditions.push('DATE(tr.start_at) >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('DATE(tr.start_at) <= ?');
    params.push(filters.dateTo);
  }

  if (filters.status) {
    conditions.push('tr.status = ?');
    params.push(filters.status);
  }

  if (filters.transportType) {
    conditions.push('tr.transport_type = ?');
    params.push(filters.transportType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT tr.*, COALESCE(tc.companion_count, 0) AS companion_count,
            vr.id AS vehicle_request_id, vr.vehicle_request_no, vr.status AS vehicle_request_status,
            va.plate_no_snapshot, va.driver_name_snapshot,
            vtl.log_status, vtl.distance_km
     FROM official_travel_requests tr
     LEFT JOIN (
       SELECT travel_request_id, COUNT(*) AS companion_count
       FROM official_travel_companions
       GROUP BY travel_request_id
     ) tc ON tc.travel_request_id = tr.id
     LEFT JOIN vehicle_requests vr ON vr.travel_request_id = tr.id
     LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
     LEFT JOIN vehicle_trip_logs vtl ON vtl.vehicle_request_id = vr.id
     ${whereClause}
     ORDER BY tr.start_at DESC, tr.id DESC`,
    params
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query('SELECT * FROM official_travel_requests WHERE id = ?', [id]);
  return rows[0] || null;
}

async function getCompanions(travelRequestId) {
  const [rows] = await db.query(
    'SELECT * FROM official_travel_companions WHERE travel_request_id = ? ORDER BY seq_no ASC',
    [travelRequestId]
  );
  return rows;
}

async function getDetailById(id) {
  const record = await getById(id);
  if (!record) {
    return null;
  }
  const [companions, vehicleRows] = await Promise.all([
    getCompanions(id),
    db.query(
      `SELECT vr.id, vr.vehicle_request_no, vr.status, vr.trip_start_at, vr.trip_end_at,
              va.vehicle_id, va.driver_id, va.plate_no_snapshot, va.driver_name_snapshot
       FROM vehicle_requests vr
       LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
       WHERE vr.travel_request_id = ?`,
      [id]
    )
  ]);

  return {
    ...record,
    companions,
    vehicleRequest: vehicleRows[0][0] || null
  };
}

async function create(payload, companions = []) {
  const connection = await db.getConnection();
  const data = mapPayload(payload);
  try {
    await ensureRunningNumberSettingsTable();
    await connection.beginTransaction();
    if (!data.request_no) {
      data.request_no = await generateRunningNumber('official_travel_requests', data.request_date, {
        connection,
        actorName: data.created_by || data.updated_by || null
      });
    }
    const [result] = await connection.query(
      `INSERT INTO official_travel_requests (
        request_no, request_date, subject, learn_to, requester_member_id, requester_name,
        requester_position, requester_group, purpose_text, destination_text, start_at, end_at,
        duration_days, duration_hours, transport_type, transport_other_text, out_of_province,
        requires_vehicle_request, status, submitted_at, approved_at, rejected_at, cancelled_at,
        approver_member_id, approver_name, approver_position, approval_comment, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.request_no, data.request_date, data.subject, data.learn_to, data.requester_member_id, data.requester_name,
        data.requester_position, data.requester_group, data.purpose_text, data.destination_text, data.start_at, data.end_at,
        data.duration_days, data.duration_hours, data.transport_type, data.transport_other_text, data.out_of_province,
        data.requires_vehicle_request, data.status, data.submitted_at, data.approved_at, data.rejected_at, data.cancelled_at,
        data.approver_member_id, data.approver_name, data.approver_position, data.approval_comment, data.created_by, data.updated_by
      ]
    );

    await upsertCompanions(connection, result.insertId, normalizeCompanions(companions));
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function update(id, payload, companions = []) {
  const connection = await db.getConnection();
  const data = mapPayload(payload);
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE official_travel_requests SET
        request_date = ?,
        subject = ?,
        learn_to = ?,
        requester_member_id = ?,
        requester_name = ?,
        requester_position = ?,
        requester_group = ?,
        purpose_text = ?,
        destination_text = ?,
        start_at = ?,
        end_at = ?,
        duration_days = ?,
        duration_hours = ?,
        transport_type = ?,
        transport_other_text = ?,
        out_of_province = ?,
        requires_vehicle_request = ?,
        status = ?,
        submitted_at = ?,
        approved_at = ?,
        rejected_at = ?,
        cancelled_at = ?,
        approver_member_id = ?,
        approver_name = ?,
        approver_position = ?,
        approval_comment = ?,
        updated_by = ?
      WHERE id = ?`,
      [
        data.request_date,
        data.subject,
        data.learn_to,
        data.requester_member_id,
        data.requester_name,
        data.requester_position,
        data.requester_group,
        data.purpose_text,
        data.destination_text,
        data.start_at,
        data.end_at,
        data.duration_days,
        data.duration_hours,
        data.transport_type,
        data.transport_other_text,
        data.out_of_province,
        data.requires_vehicle_request,
        data.status,
        data.submitted_at,
        data.approved_at,
        data.rejected_at,
        data.cancelled_at,
        data.approver_member_id,
        data.approver_name,
        data.approver_position,
        data.approval_comment,
        data.updated_by,
        id
      ]
    );
    await upsertCompanions(connection, id, normalizeCompanions(companions));
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function submit(id, user) {
  await db.query(
    `UPDATE official_travel_requests
     SET status = 'submitted', submitted_at = NOW(), updated_by = ?
     WHERE id = ? AND status = 'draft'`,
    [user?.fullname || user?.username || 'system', id]
  );
}

async function listEligibleForVehicleRequest() {
  const [rows] = await db.query(`
    SELECT tr.id, tr.request_no, tr.subject, tr.request_date, tr.requester_name,
           tr.requester_position, tr.requester_group, tr.destination_text, tr.purpose_text,
           tr.start_at, tr.end_at, tr.status,
           COALESCE(tc.companion_count, 0) AS companion_count
    FROM official_travel_requests tr
    LEFT JOIN (
      SELECT travel_request_id, COUNT(*) AS companion_count
      FROM official_travel_companions
      GROUP BY travel_request_id
    ) tc ON tc.travel_request_id = tr.id
    LEFT JOIN vehicle_requests vr ON vr.travel_request_id = tr.id
    WHERE vr.id IS NULL
      AND tr.status IN ('draft', 'submitted', 'approved')
      AND (
        tr.transport_type = 'official_vehicle'
        OR tr.requires_vehicle_request = 1
      )
    ORDER BY tr.request_date DESC, tr.id DESC
  `);
  return rows;
}

async function listApprovedInRange(startDate, endDate) {
  try {
    const [rows] = await db.query(`
      SELECT
        tr.*,
        tc.companion_names,
        vr.id AS vehicle_request_id,
        vr.vehicle_request_no,
        vr.status AS vehicle_request_status,
        vr.trip_start_at,
        vr.trip_end_at,
        va.plate_no_snapshot,
        va.driver_name_snapshot
      FROM official_travel_requests tr
      LEFT JOIN (
        SELECT travel_request_id,
               GROUP_CONCAT(companion_name ORDER BY seq_no SEPARATOR ', ') AS companion_names
        FROM official_travel_companions
        GROUP BY travel_request_id
      ) tc ON tc.travel_request_id = tr.id
      LEFT JOIN vehicle_requests vr ON vr.travel_request_id = tr.id
      LEFT JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
      WHERE tr.status = 'approved'
        AND tr.start_at <= ?
        AND tr.end_at >= ?
      ORDER BY tr.start_at ASC, tr.id ASC
    `, [endDate, startDate]);
    return rows;
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw error;
  }
}

async function listPendingApproval() {
  const [rows] = await db.query(`
    SELECT tr.*, COALESCE(tc.companion_count, 0) AS companion_count
    FROM official_travel_requests tr
    LEFT JOIN (
      SELECT travel_request_id, COUNT(*) AS companion_count
      FROM official_travel_companions
      GROUP BY travel_request_id
    ) tc ON tc.travel_request_id = tr.id
    WHERE tr.status = 'submitted'
    ORDER BY tr.submitted_at ASC, tr.id ASC
  `);
  return rows;
}

async function approve(id, user, approvalComment = null) {
  await db.query(
    `UPDATE official_travel_requests
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

async function reject(id, user, approvalComment = null) {
  await db.query(
    `UPDATE official_travel_requests
     SET status = 'rejected',
         rejected_at = NOW(),
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

async function cancel(id, user) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[travelRequest]] = await connection.query(
      `SELECT tr.id, tr.status,
              vr.id AS vehicle_request_id,
              vr.status AS vehicle_request_status
       FROM official_travel_requests tr
       LEFT JOIN vehicle_requests vr ON vr.travel_request_id = tr.id
       WHERE tr.id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!travelRequest) {
      const error = new Error('NOT_FOUND');
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (!['draft', 'submitted', 'approved'].includes(travelRequest.status)) {
      const error = new Error('TRAVEL_CANCEL_NOT_ALLOWED');
      error.code = 'TRAVEL_CANCEL_NOT_ALLOWED';
      throw error;
    }

    if (['in_progress', 'completed'].includes(travelRequest.vehicle_request_status)) {
      const error = new Error('LINKED_VEHICLE_ACTIVE');
      error.code = 'LINKED_VEHICLE_ACTIVE';
      throw error;
    }

    await connection.query(
      `UPDATE official_travel_requests
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_by = ?
       WHERE id = ?`,
      [user?.fullname || user?.username || 'system', id]
    );

    if (
      travelRequest.vehicle_request_id &&
      ['draft', 'submitted', 'approved', 'assigned', 'rejected'].includes(travelRequest.vehicle_request_status)
    ) {
      await connection.query(
        `UPDATE vehicle_requests
         SET status = 'cancelled',
             cancelled_at = NOW(),
             updated_by = ?
         WHERE id = ?`,
        [user?.fullname || user?.username || 'system', travelRequest.vehicle_request_id]
      );
    }

    await connection.commit();
    return travelRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function remove(id, options = {}) {
  const force = options.force === true;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[travelRequest]] = await connection.query(
      `SELECT id
       FROM official_travel_requests
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!travelRequest) {
      const error = new Error('NOT_FOUND');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const [linkedVehicleRequests] = await connection.query(
      `SELECT id, status
       FROM vehicle_requests
       WHERE travel_request_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!force && linkedVehicleRequests.some((request) => ['in_progress', 'completed'].includes(request.status))) {
      const error = new Error('LINKED_VEHICLE_ACTIVE');
      error.code = 'LINKED_VEHICLE_ACTIVE';
      throw error;
    }

    const vehicleRequestIds = linkedVehicleRequests.map((request) => request.id);

    if (vehicleRequestIds.length) {
      await connection.query('DELETE FROM vehicle_trip_logs WHERE vehicle_request_id IN (?)', [vehicleRequestIds]);
      await connection.query('DELETE FROM vehicle_assignments WHERE vehicle_request_id IN (?)', [vehicleRequestIds]);
      await connection.query('DELETE FROM vehicle_requests WHERE id IN (?)', [vehicleRequestIds]);
    }

    await connection.query('DELETE FROM official_travel_companions WHERE travel_request_id = ?', [id]);
    await connection.query('DELETE FROM official_travel_requests WHERE id = ?', [id]);

    await connection.commit();
    return {
      id,
      deletedVehicleRequestCount: vehicleRequestIds.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  cancel,
  create,
  getById,
  getCompanions,
  getDetailById,
  listAll,
  listReport,
  listPendingApproval,
  listApprovedInRange,
  listEligibleForVehicleRequest,
  remove,
  approve,
  reject,
  submit,
  update
};
