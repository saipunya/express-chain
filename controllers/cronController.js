const activityModel = require('../models/activityModel');
const telegramService = require('../services/telegramService');

exports.runCron = async (req, res) => {
  try {
    const message = 'แจ้งเตือนกิจกรรมวันนี้จากระบบ CoopChain';
    await telegramService.sendMessage(message);
    return res.send('ส่งแจ้งเตือนเรียบร้อยแล้ว');
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน:', error.message);
    return res.status(500).send('เกิดข้อผิดพลาดในการส่งแจ้งเตือน: ' + error.message);
  }
};

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
    git_time: '',
    git_act: item.purpose_text || 'ขออนุมัติเดินทางไปราชการ',
    git_place: item.destination_text || '-',
    git_goto: buildParticipants(item) || '-',
    git_respon: item.requester_name || '-',
    git_maihed: buildNote(item) || '-',
    git_group: item.requester_group || 'ไปราชการ',
    git_saveby: `workflow-travel-${item.id}`,
    git_savedate: nowTimestamp()
  };
}

exports.buildTodayActivityMessage = async () => {
  const activities = await activityModel.getActivitiesForToday();
  if (!activities || activities.length === 0) return null;

  let message = 'กิจกรรมประจำวันวันนี้\n';
  activities.forEach((act, index) => {
    message += `\n${index + 1}. ${act.activity || '-'}\n`;
    if (act.date_act) message += `   วันที่: ${act.date_act}\n`;
    if (act.act_time) message += `   เวลา: ${act.act_time}\n`;
    if (act.place) message += `   สถานที่: ${act.place}\n`;
    if (act.co_person) message += `   ผู้รับผิดชอบ: ${act.co_person}\n`;
  });
  return message;
};

exports.notifyActivityToday = async () => {
  const message = await exports.buildTodayActivityMessage();
  if (!message) {
    console.log('ไม่มีรายการกิจกรรมสำหรับวันนี้');
    return;
  }

  await telegramService.sendMessage(message);
};

exports.buildGitgumPayload = buildGitgumPayload;
