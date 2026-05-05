const gitgumModel = require('../models/gitgumModel');

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

function toTime(value) {
  if (!value) {
    return '';
  }
  const text = String(value);
  const match = text.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function formatTimeRange(startAt, endAt) {
  const startTime = toTime(startAt);
  const endTime = toTime(endAt);

  if (!startTime) {
    return '';
  }

  if (endTime && endTime !== startTime) {
    return `${startTime} - ${endTime}`;
  }

  return startTime;
}

function nowTimestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function buildParticipants(item) {
  const companionNames = Array.isArray(item.companions)
    ? item.companions.map((companion) => companion.companion_name).filter(Boolean)
    : [];
  return [item.requester_name, ...companionNames].filter(Boolean).join(', ');
}

function buildNote(item) {
  const notes = [];
  if (item.request_no) notes.push(`เลขที่คำขอ: ${item.request_no}`);
  if (item.purpose_text) notes.push(`วัตถุประสงค์: ${item.purpose_text}`);
  if (item.transport_type) notes.push(`วิธีเดินทาง: ${item.transport_type}`);
  if (item.vehicleRequest?.vehicle_request_no) {
    notes.push(`คำขอใช้รถ: ${item.vehicleRequest.vehicle_request_no} (${item.vehicleRequest.status || '-'})`);
  }
  if (item.vehicleRequest?.plate_no_snapshot || item.vehicleRequest?.driver_name_snapshot) {
    notes.push(`รถ: ${item.vehicleRequest?.plate_no_snapshot || '-'} คนขับ: ${item.vehicleRequest?.driver_name_snapshot || '-'}`);
  }
  return notes.join(' | ');
}

function buildGitgumPayload(item) {
  return {
    git_date: toSqlDate(item.start_at || item.request_date),
    git_time: formatTimeRange(item.start_at, item.end_at),
    git_act: item.purpose_text || 'ขออนุมัติเดินทางไปราชการ',
    git_place: item.destination_text || '-',
    git_goto: buildParticipants(item) || '-',
    git_respon: item.requester_name || '-',
    git_maihed: buildNote(item) || '-',
    git_group: item.requester_group || 'ไปราชการ',
    git_saveby: gitgumModel.buildWorkflowTravelKey(item.id),
    git_savedate: nowTimestamp()
  };
}

async function syncApprovedTravel(item) {
  if (!item || !item.id) {
    return;
  }

  if (item.status !== 'approved') {
    await gitgumModel.deleteByWorkflowTravelId(item.id);
    return;
  }

  const payload = buildGitgumPayload(item);
  const existing = await gitgumModel.findByWorkflowTravelId(item.id);
  if (existing) {
    await gitgumModel.update(existing.git_id, payload);
    return existing.git_id;
  }

  return gitgumModel.insert(payload);
}

async function removeTravel(itemOrId) {
  const travelRequestId = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
  if (!travelRequestId) {
    return;
  }
  await gitgumModel.deleteByWorkflowTravelId(travelRequestId);
}

async function backfillApprovedTravelSync() {
  const officialTravelRequestModel = require('../models/officialTravelRequestModel');
  const travelItems = await officialTravelRequestModel.listApprovedInRange('1900-01-01', '2100-12-31');
  let processed = 0;

  for (const item of travelItems) {
    await syncApprovedTravel(item);
    processed += 1;
  }

  return {
    processed
  };
}

module.exports = {
  backfillApprovedTravelSync,
  syncApprovedTravel,
  removeTravel
};
