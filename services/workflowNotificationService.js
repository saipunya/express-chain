const notify = require('./notifyService');

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch (_) {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value || '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function send(message) {
  try {
    const payload = typeof message === 'string'
      ? { html: message, telegramTarget: 'workflow' }
      : { ...message, telegramTarget: 'workflow' };
    await notify.broadcast(payload);
  } catch (error) {
    console.error('Workflow notification failed:', error.message);
  }
}

async function notifyTravelSubmitted(item) {
  return send(`
<b>คำขอไปราชการส่งใหม่</b>
เลขที่: ${escapeHtml(item.request_no)}
เรื่อง: ${escapeHtml(item.subject)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
ช่วงเวลา: ${escapeHtml(formatDateTime(item.start_at))} ถึง ${escapeHtml(formatDateTime(item.end_at))}
สถานะ: ${escapeHtml(item.status)}
  `);
}

async function notifyTravelDecision(item, actionLabel, actorName) {
  return send(`
<b>${escapeHtml(actionLabel)}คำขอไปราชการ</b>
เลขที่: ${escapeHtml(item.request_no)}
เรื่อง: ${escapeHtml(item.subject)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ผู้พิจารณา: ${escapeHtml(actorName)}
สถานะ: ${escapeHtml(item.status)}
ความเห็น: ${escapeHtml(item.approval_comment || '-')}
  `);
}

async function notifyVehicleSubmitted(item) {
  return send(`
<b>คำขอใช้รถส่งใหม่</b>
เลขที่: ${escapeHtml(item.vehicle_request_no)}
อ้างอิงไปราชการ: ${escapeHtml(item.travel_request_no)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
ช่วงเวลา: ${escapeHtml(formatDateTime(item.trip_start_at))} ถึง ${escapeHtml(formatDateTime(item.trip_end_at))}
สถานะ: ${escapeHtml(item.status)}
  `);
}

async function notifyVehicleDecision(item, actionLabel, actorName) {
  return send(`
<b>${escapeHtml(actionLabel)}คำขอใช้รถ</b>
เลขที่: ${escapeHtml(item.vehicle_request_no)}
อ้างอิงไปราชการ: ${escapeHtml(item.travel_request_no)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ผู้พิจารณา: ${escapeHtml(actorName)}
สถานะ: ${escapeHtml(item.status)}
ความเห็น: ${escapeHtml(item.approval_comment || '-')}
  `);
}

async function notifyVehicleAssigned(item, actorName) {
  return send(`
<b>มอบหมายรถและคนขับแล้ว</b>
เลขที่คำขอใช้รถ: ${escapeHtml(item.vehicle_request_no)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
รถ: ${escapeHtml(item.plate_no_snapshot || '-')}
คนขับ: ${escapeHtml(item.driver_name_snapshot || '-')}
ผู้มอบหมาย: ${escapeHtml(actorName)}
สถานะ: ${escapeHtml(item.status)}
  `);
}

module.exports = {
  notifyTravelDecision,
  notifyTravelSubmitted,
  notifyVehicleAssigned,
  notifyVehicleDecision,
  notifyVehicleSubmitted
};