const gitgumModel = require('../models/gitgumModel');

function toSqlDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(value);
  }
  return String(value).slice(0, 10);
}

function toTimeLabel(value) {
  if (!value) {
    return '';
  }
  const text = String(value).trim();
  const rangeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/);
  if (rangeMatch) {
    return `${normalizeTime(rangeMatch[1])} - ${normalizeTime(rangeMatch[2])}`;
  }
  const singleMatch = text.match(/(\d{1,2}[:.]\d{2})/);
  return singleMatch ? normalizeTime(singleMatch[1]) : text;
}

function normalizeTime(value) {
  const match = String(value || '').match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) {
    return String(value || '').trim();
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function nowTimestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function buildGitgumPayload(meeting) {
  const room = meeting.mee_room || '-';
  const responsible = meeting.mee_respon || '-';

  return {
    git_date: toSqlDate(meeting.mee_date),
    git_time: toTimeLabel(meeting.mee_time),
    git_act: meeting.mee_subject || 'จองห้องประชุม',
    git_place: room,
    git_goto: room,
    git_respon: responsible,
    git_maihed: [`รายการจองห้องประชุม #${meeting.mee_id}`, `ผู้รับผิดชอบ: ${responsible}`].join(' | '),
    git_group: 'ห้องประชุม',
    git_saveby: gitgumModel.buildMeetingRoomKey(meeting.mee_id),
    git_savedate: nowTimestamp()
  };
}

async function syncMeetingRoom(meeting) {
  if (!meeting || !meeting.mee_id) {
    return;
  }

  const payload = buildGitgumPayload(meeting);
  const existing = await gitgumModel.findByMeetingRoomId(meeting.mee_id);
  if (existing) {
    await gitgumModel.update(existing.git_id, payload);
    return existing.git_id;
  }

  return gitgumModel.insert(payload);
}

async function removeMeetingRoom(meetingOrId) {
  const meetingId = typeof meetingOrId === 'object' ? meetingOrId?.mee_id : meetingOrId;
  if (!meetingId) {
    return;
  }
  await gitgumModel.deleteByMeetingRoomId(meetingId);
}

module.exports = {
  syncMeetingRoom,
  removeMeetingRoom
};
