const gitgumModel = require('../models/gitgumModel');
const officialTravelRequestModel = require('../models/officialTravelRequestModel');

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function toHHmm(value) {
  if (!value) {
    return null;
  }
  const source = String(value).trim();
  if (/^\d{4}$/.test(source)) {
    return `${source.slice(0, 2)}:${source.slice(2, 4)}`;
  }
  const match = source.match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) {
    return null;
  }
  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  if (Number(hour) > 23 || Number(minute) > 59) {
    return null;
  }
  return `${hour}:${minute}`;
}

function toYMD(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(value);
    } catch (_) {
      return value.toISOString().slice(0, 10);
    }
  }
  return String(value).slice(0, 10);
}

function addDaysYmd(ymd, days) {
  if (!ymd) {
    return null;
  }
  const date = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setDate(date.getDate() + Number(days || 0));
  return toYMD(date);
}

function formatThaiDateYmd(ymd) {
  if (!ymd) {
    return '-';
  }
  const [year, month, day] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return '-';
  }
  const thaiYear = year + 543;
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${thaiYear}`;
}

function formatThaiDateRange(startYmd, endYmd) {
  if (!startYmd) {
    return '-';
  }
  if (!endYmd || startYmd === endYmd) {
    return formatThaiDateYmd(startYmd);
  }
  return `${formatThaiDateYmd(startYmd)} ถึง ${formatThaiDateYmd(endYmd)}`;
}

function buildGitgumEvent(row) {
  const workflowTravelId = gitgumModel.parseWorkflowTravelId(row.git_saveby);
  const meetingRoomId = gitgumModel.parseMeetingRoomId(row.git_saveby);
  const isWorkflowTravel = Boolean(workflowTravelId);
  const isMeetingRoom = Boolean(meetingRoomId);
  if (isWorkflowTravel) {
    return null;
  }
  const dateStr = toYMD(row.git_date);
  const timeStr = toHHmm(row.git_time);
  const start = dateStr ? (timeStr ? `${dateStr}T${timeStr}` : dateStr) : undefined;
  if (!start) {
    return null;
  }

  const requestNumberMatch = String(row.git_maihed || '').match(/เลขที่คำขอ:\s*([^|]+)/);
  const requestNumber = requestNumberMatch ? requestNumberMatch[1].trim() : null;

  return {
    id: `gitgum-${row.git_id}`,
    title: [row.git_act, row.git_place ? `@${row.git_place}` : null].filter(Boolean).join(' '),
    start,
    allDay: !timeStr,
    extendedProps: {
      sourceType: isMeetingRoom ? 'meetingroom' : 'gitgum',
      sourceLabel: isMeetingRoom ? 'จองห้องประชุม' : 'กิจกรรมสำนักงาน',
      dateLabel: formatThaiDateRange(dateStr, dateStr),
      timeLabel: row.git_time || null,
      requestNumber,
      place: row.git_place,
      respon: row.git_respon,
      goto: row.git_goto,
      group: row.git_group,
      maihed: row.git_maihed,
      detailUrl: isWorkflowTravel ? `/official-travel/${workflowTravelId}` : (isMeetingRoom ? '/meetingroom' : `/gitgum/view/${row.git_id}`)
    }
  };
}

function buildTravelEvent(row) {
  const dateStr = toYMD(row.start_at);
  const start = dateStr || undefined;
  if (!start) {
    return null;
  }

  const endStr = toYMD(row.end_at);
  const end = endStr && endStr !== dateStr ? addDaysYmd(endStr, 1) : undefined;
  const startTime = toHHmm(row.start_at);
  const endTime = toHHmm(row.end_at);
  const timeLabel = startTime ? (endTime && endTime !== startTime ? `${startTime} - ${endTime}` : startTime) : null;
  const dateLabel = formatThaiDateRange(dateStr, endStr);

  const companions = row.companion_names ? `ผู้ร่วมเดินทาง: ${row.companion_names}` : null;
  const vehicleSummary = row.plate_no_snapshot || row.driver_name_snapshot
    ? ['รถ', row.plate_no_snapshot || '-', 'คนขับ', row.driver_name_snapshot || '-'].join(' ')
    : null;
  const note = [companions, vehicleSummary].filter(Boolean).join(' | ');

  return {
    id: `travel-${row.id}`,
    title: [row.subject, row.destination_text ? `@${row.destination_text}` : null].filter(Boolean).join(' '),
    start,
    end,
    allDay: true,
    extendedProps: {
      sourceType: 'travel_request',
      sourceLabel: 'คำขอไปราชการ',
      requestNumber: row.request_no,
      dateLabel,
      approvalStatus: row.status,
      transportType: row.transport_type,
      vehicleRequestNo: row.vehicle_request_no || null,
      vehiclePlate: row.plate_no_snapshot || null,
      driverName: row.driver_name_snapshot || null,
      timeLabel,
      place: row.destination_text,
      respon: row.requester_name,
      goto: row.companion_names ? `${row.requester_name}, ${row.companion_names}` : row.requester_name,
      group: row.requester_group,
      maihed: note || row.purpose_text,
      detailUrl: `/official-travel/${row.id}`
    }
  };
}

async function getMergedCalendarEvents({ startDate, endDate }) {
  const [gitgumRows, travelRows] = await Promise.all([
    gitgumModel.findBetween(startDate, endDate),
    officialTravelRequestModel.listApprovedInRange(startDate, endDate)
  ]);

  return [
    ...gitgumRows.map(buildGitgumEvent),
    ...travelRows.map(buildTravelEvent)
  ]
    .filter(Boolean)
    .sort((left, right) => String(left.start).localeCompare(String(right.start)));
}

module.exports = {
  getMergedCalendarEvents,
  toHHmm,
  toYMD
};
