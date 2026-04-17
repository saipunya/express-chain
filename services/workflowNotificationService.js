const notify = require('./notifyService');
const BASE_URL = String(process.env.BASE_URL || '').replace(/\/+$/, '');

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

function normalizeBaseUrlForButton(baseUrl) {
  if (!baseUrl) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol === 'https:') {
      return baseUrl.replace(/\/\/+$/, '');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return baseUrl.replace(/\/\/+$/, '');
    }

    parsed.protocol = 'https:';
    return String(parsed).replace(/\/+$/, '');
  } catch (_) {
    return baseUrl.replace(/\/\/+$/, '');
  }
}

function buildLoginRedirectUrl(pathname) {
  if (!BASE_URL || !pathname) {
    return null;
  }

  const safePath = String(pathname).startsWith('/') ? pathname : `/${pathname}`;
  return `${BASE_URL}/auth/login?returnTo=${encodeURIComponent(safePath)}`;
}

function buildLoginRedirectButtonUrl(pathname) {
  if (!BASE_URL || !pathname) {
    return null;
  }

  const buttonBase = normalizeBaseUrlForButton(BASE_URL);
  const safePath = String(pathname).startsWith('/') ? pathname : `/${pathname}`;
  return `${buttonBase}/auth/login?returnTo=${encodeURIComponent(safePath)}`;
}

function isTelegramInlineKeyboardUrlValid(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function buildApprovalButton(label, pathname) {
  const url = buildLoginRedirectButtonUrl(pathname);
  if (!isTelegramInlineKeyboardUrlValid(url)) {
    return null;
  }

  return {
    inline_keyboard: [[{ text: label, url }]]
  };
}

async function notifyTravelSubmitted(item) {
  const approvalUrl = buildLoginRedirectUrl(`/vehicle-approval/travel/${item.id}`);
  const approvalLink = approvalUrl
    ? `<a href="${escapeHtml(approvalUrl)}">เปิดหน้าอนุมัติคำขอไปราชการ</a>`
    : '-';
  return send({
    html: `
<b>คำขอไปราชการส่งใหม่</b>
เลขที่: ${escapeHtml(item.request_no)}
เรื่อง: ${escapeHtml(item.subject)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
ช่วงเวลา: ${escapeHtml(formatDateTime(item.start_at))} ถึง ${escapeHtml(formatDateTime(item.end_at))}
สถานะ: ${escapeHtml(item.status)}
${approvalLink}
  `,
    replyMarkup: buildApprovalButton('เปิดหน้าอนุมัติไปราชการ', `/vehicle-approval/travel/${item.id}`)
  });
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
  const requestNo = item.travel_request_no || item.vehicle_request_no;
  const approvalUrl = buildLoginRedirectUrl(`/vehicle-approval/request/${item.id}`);
  const approvalLink = approvalUrl
    ? `<a href="${escapeHtml(approvalUrl)}">เปิดหน้าอนุมัติคำขอใช้รถ</a>`
    : '-';
  return send({
    html: `
<b>คำขอใช้รถส่งใหม่</b>
เลขที่: ${escapeHtml(requestNo)}
อ้างอิงไปราชการ: ${escapeHtml(item.travel_request_no)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
ช่วงเวลา: ${escapeHtml(formatDateTime(item.trip_start_at))} ถึง ${escapeHtml(formatDateTime(item.trip_end_at))}
สถานะ: ${escapeHtml(item.status)}
${approvalLink}
  `,
    replyMarkup: buildApprovalButton('เปิดหน้าอนุมัติคำขอใช้รถ', `/vehicle-approval/request/${item.id}`)
  });
}

async function notifyVehicleDecision(item, actionLabel, actorName) {
  const requestNo = item.travel_request_no || item.vehicle_request_no;
  return send(`
<b>${escapeHtml(actionLabel)}คำขอใช้รถ</b>
เลขที่: ${escapeHtml(requestNo)}
อ้างอิงไปราชการ: ${escapeHtml(item.travel_request_no)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ผู้พิจารณา: ${escapeHtml(actorName)}
สถานะ: ${escapeHtml(item.status)}
ความเห็น: ${escapeHtml(item.approval_comment || '-')}
  `);
}

async function notifyVehicleAssigned(item, actorName) {
  const requestNo = item.travel_request_no || item.vehicle_request_no;
  return send(`
<b>มอบหมายรถและคนขับแล้ว</b>
เลขที่คำขอใช้รถ: ${escapeHtml(requestNo)}
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
