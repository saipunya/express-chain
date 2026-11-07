const STEP_LABELS = {
  1: 'ประกาศผู้ชำระบัญชี',
  2: 'รับมอบทรัพย์สิน',
  3: 'ส่งงบ ม.80',
  4: 'ผู้สอบบัญชีรับรองงบ',
  5: 'ประชุมใหญ่อนุมัติงบ',
  6: 'จัดการทรัพย์สิน/หนี้สิน',
  7: 'ส่งรายงานการชำระบัญชี',
  8: 'ผู้สอบบัญชีรับรองรายงาน',
  9: 'ถอนชื่อออกจากทะเบียน',
  10: 'ส่งมอบเอกสารหลักฐาน'
};

function isValidProcessDate(value) {
  if (!value || value === '0000-00-00' || /^1899-11-30/.test(String(value))) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() >= 1950;
}

function getLatestProcess(row) {
  for (let step = 10; step >= 1; step -= 1) {
    const value = row && row[`pr_s${step}`];
    if (isValidProcessDate(value)) return { step, date: value };
  }
  return { step: 0, date: null };
}

function getInstitutionKind(row) {
  const group = String(row?.coop_group || '').trim();
  const name = String(row?.c_name || '').trim();
  if (group === 'กลุ่มเกษตรกร' || name.startsWith('กลุ่มเกษตรกร')) return 'farmer';
  return 'coop';
}

function formatThaiDate(value) {
  if (!isValidProcessDate(value)) return '';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok'
  }).format(new Date(value));
}

function buildChamraSummary(rows = []) {
  const data = Array.isArray(rows) ? rows : [];
  const stepCounts = Array.from({ length: 10 }, (_, index) => ({
    step: index + 1,
    label: STEP_LABELS[index + 1],
    count: 0,
    percent: 0
  }));
  const summary = {
    total: data.length,
    inProgress: 0,
    withdrawn: 0,
    noProcess: 0,
    completionPercent: 0,
    cooperativeCount: 0,
    farmerGroupCount: 0,
    latestUpdateThai: '',
    steps: []
  };

  let latestUpdateMs = 0;
  let latestUpdateValue = null;
  data.forEach((row) => {
    const latest = getLatestProcess(row);
    if (latest.step === 0) summary.noProcess += 1;
    else if (latest.step >= 9) summary.withdrawn += 1;
    else summary.inProgress += 1;

    if (latest.step > 0) stepCounts[latest.step - 1].count += 1;
    if (getInstitutionKind(row) === 'farmer') summary.farmerGroupCount += 1;
    else summary.cooperativeCount += 1;

    if (latest.date) {
      const timestamp = new Date(latest.date).getTime();
      if (Number.isFinite(timestamp) && timestamp > latestUpdateMs) {
        latestUpdateMs = timestamp;
        latestUpdateValue = latest.date;
      }
    }
  });

  summary.completionPercent = summary.total > 0 ? (summary.withdrawn / summary.total) * 100 : 0;
  summary.steps = stepCounts
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      percent: summary.total > 0 ? (item.count / summary.total) * 100 : 0
    }));
  summary.latestUpdateThai = formatThaiDate(latestUpdateValue);
  return summary;
}

module.exports = { STEP_LABELS, isValidProcessDate, getLatestProcess, buildChamraSummary };

// Snapshot immediately before October 1, and progress through the reporting cutoff.
function buildMovementRow(row, startDate, endDate) {
  const { dateKey } = require('./chamraFiscalYear');
  let baseline = { step: 0, date: null };
  let current = { step: 0, date: null };
  const activities = [];
  for (let step = 1; step <= 10; step++) {
    const date = dateKey(row[`pr_s${step}`]);
    if (!date || date < '1950-01-01') continue;
    if (date < startDate) baseline = { step, date };
    if (date <= endDate) current = { step, date };
    if (date >= startDate && date <= endDate) activities.push({ step, date });
  }
  if (!activities.length) return null;
  return {
    institution_code: row.pr_code,
    institution_name: row.c_name,
    institution_status: row.c_status,
    institution_kind: row.coop_group,
    date: activities.map(a => a.date).sort()[0],
    oct1_step: baseline.step,
    oct1_date: baseline.date,
    current_max_step: current.step,
    current_max_date: current.date,
    activities
  };
}
module.exports.buildMovementRow = buildMovementRow;

function snapshotProcesses(rows, cutoffDate) {
  const { dateKey } = require('./chamraFiscalYear');
  return rows.map(row => {
    const snapshot = { ...row };
    for (let step = 1; step <= 10; step++) {
      const key = `pr_s${step}`;
      const date = dateKey(row[key]);
      snapshot[key] = date && date >= '1950-01-01' && date <= cutoffDate ? date : null;
    }
    return snapshot;
  });
}
module.exports.snapshotProcesses = snapshotProcesses;
