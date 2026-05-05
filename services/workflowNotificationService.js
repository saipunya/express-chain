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
      ? { html: message, telegramTarget: 'workflow', channels: ['telegram'] }
      : { ...message, telegramTarget: 'workflow', channels: ['telegram'] };

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

async function notifyTravelSubmitted(item, vehicleRequested = false) {
  const approvalUrl = buildLoginRedirectUrl(`/vehicle-approval/travel/${item.id}`);
  const approvalLink = approvalUrl
    ? `<a href="${escapeHtml(approvalUrl)}">เปิดหน้าพิจารณาคำขอไปราชการ</a>`
    : '-';
  const usesOfficialVehicle = vehicleRequested || item.transport_type === 'official_vehicle' || Number(item.requires_vehicle_request) === 1;

  return send({
    html: `
<b>คำขอไปราชการส่งใหม่</b>
เลขที่: ${escapeHtml(item.request_no)}
เรื่อง: ${escapeHtml(item.subject)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
ช่วงเวลา: ${escapeHtml(formatDateTime(item.start_at))} ถึง ${escapeHtml(formatDateTime(item.end_at))}
ใช้รถยนต์ราชการ: ${usesOfficialVehicle ? 'ใช่' : 'ไม่ใช่'}
สถานะ: ${escapeHtml(item.status)}
${approvalLink}
    `,
    replyMarkup: buildApprovalButton('เปิดหน้าพิจารณาคำขอไปราชการ', `/vehicle-approval/travel/${item.id}`)
  });
}

async function notifyVehicleSubmitted(item) {
  const requestNo = item.travel_request_no || item.vehicle_request_no;
  const approvalUrl = buildLoginRedirectUrl(`/vehicle-approval/request/${item.id}`);
  const approvalLink = approvalUrl
    ? `<a href="${escapeHtml(approvalUrl)}">เปิดหน้าพิจารณาคำขอใช้รถ</a>`
    : '-';

  return send({
    html: `
<b>คำขอใช้รถส่งใหม่</b>
เลขที่: ${escapeHtml(requestNo)}
อ้างอิงคำขอไปราชการ: ${escapeHtml(item.travel_request_no)}
ผู้ขอ: ${escapeHtml(item.requester_name)}
ปลายทาง: ${escapeHtml(item.destination_text)}
ช่วงเวลา: ${escapeHtml(formatDateTime(item.trip_start_at))} ถึง ${escapeHtml(formatDateTime(item.trip_end_at))}
สถานะ: ${escapeHtml(item.status)}
${approvalLink}
    `,
    replyMarkup: buildApprovalButton('เปิดหน้าพิจารณาคำขอใช้รถ', `/vehicle-approval/request/${item.id}`)
  });
}

module.exports = {
  notifyTravelSubmitted,
  notifyVehicleSubmitted
};
