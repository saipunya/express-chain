// routes/homeRoutes.js

const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const activeCoopModel = require('../models/activeCoopModel');
const bigmeetModel = require('../models/bigmeetModel');
const { requireLogin, noCache } = require('../middlewares/authMiddleware');

function getLandingPath(user) {
  const mClass = String(user?.mClass || user?.m_class || '').trim().toLowerCase();
  return ['c', 'g'].includes(mClass) ? '/homecoop' : '/home/';
}

function getBangkokParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  return parts.reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
}

function toMonthDay(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const md = trimmed.slice(5, 10);
    return /^\d{2}-\d{2}$/.test(md) ? md : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  }
  return null;
}

function addDaysUtc(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date;
}

function formatThaiDate(date) {
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok'
  });
}

function formatAccountingYearLabel(row) {
  const monthDay = toMonthDay(row?.end_day);
  if (monthDay) {
    const [month, day] = monthDay.split('-').map(Number);
    const date = new Date(Date.UTC(2024, month - 1, day));
    return date.toLocaleDateString('th-TH', {
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  }

  const dateMs = parseDateToUtcMs(row?.end_date_fmt);
  if (dateMs !== null) {
    return formatThaiDate(new Date(dateMs));
  }

  return '-';
}

function getInstitutionCategory(row) {
  const coopGroup = String(row?.coop_group || '').trim();
  const inOutGroup = String(row?.in_out_group || '').trim();

  if (coopGroup.includes('กลุ่มเกษตรกร')) return 'farmer';
  if (coopGroup.includes('สหกรณ์') && !inOutGroup.includes('นอก')) return 'agri';
  return 'non_agri';
}

function buildInstitutionSummary(rows = []) {
  const summary = {
    agri: {
      key: 'agri',
      label: 'สหกรณ์ภาคการเกษตร',
      shortLabel: 'ภาคการเกษตร',
      icon: 'bi-flower1',
      tone: 'green',
      count: 0,
      rows: []
    },
    non_agri: {
      key: 'non_agri',
      label: 'สหกรณ์นอกภาค',
      shortLabel: 'นอกภาค',
      icon: 'bi-buildings',
      tone: 'teal',
      count: 0,
      rows: []
    },
    farmer: {
      key: 'farmer',
      label: 'กลุ่มเกษตรกร',
      shortLabel: 'กลุ่มเกษตรกร',
      icon: 'bi-people',
      tone: 'amber',
      count: 0,
      rows: []
    }
  };

  rows.forEach((row) => {
    const key = getInstitutionCategory(row);
    const item = {
      c_code: row.c_code || '',
      c_name: row.c_name || '-',
      c_group: row.c_group || '-',
      coop_group: row.coop_group || '-',
      in_out_group: row.in_out_group || '-',
      accountingYearLabel: formatAccountingYearLabel(row)
    };
    summary[key].rows.push(item);
  });

  Object.values(summary).forEach((group) => {
    group.rows.sort((a, b) => (a.c_name || '').localeCompare(b.c_name || '', 'th-TH'));
    group.count = group.rows.length;
  });

  return summary;
}

function parseDateToUtcMs(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const ymd = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const [y, m, d] = ymd.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeDateKey(value) {
  const ms = parseDateToUtcMs(value);
  if (ms === null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function getDeadlineYearForEndDay(monthDay, currentYear) {
  if (!monthDay) return currentYear;
  const month = Number(monthDay.split('-')[0]);
  if (Number.isNaN(month)) return currentYear;
  return month >= 4 ? currentYear - 1 : currentYear;
}

function groupByCoopGroup(rows) {
  const grouped = rows.reduce((acc, row) => {
    const groupKey = row.c_group || 'ไม่ระบุกลุ่ม';
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(row);
    return acc;
  }, {});

  return Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, 'th-TH'))
    .map((groupName) => ({
      groupName,
      rows: grouped[groupName].slice().sort((a, b) => (a.c_name || '').localeCompare(b.c_name || '', 'th-TH'))
    }));
}

async function getMainDeadlineData() {
  const baseRows = await activeCoopModel.getMeetingDeadlineBase();
  const now = new Date();
  const bangkokParts = getBangkokParts(now);
  const currentYear = Number(bangkokParts.year);
  const todayStartMs = Date.UTC(
    Number(bangkokParts.year),
    Number(bangkokParts.month) - 1,
    Number(bangkokParts.day)
  );
  const inThirtyDaysMs = todayStartMs + (30 * 24 * 60 * 60 * 1000);
  const thisMonthKey = `${bangkokParts.year}-${bangkokParts.month}`;
  const monthLabel = now.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok'
  });

  const rowsWithDeadlines = (baseRows || [])
    .map((row) => {
      const monthDay = toMonthDay(row.end_day);
      if (!monthDay) return null;
      const endDateYear = getDeadlineYearForEndDay(monthDay, currentYear);
      const endDateYmd = `${endDateYear}-${monthDay}`;
      const endDateObj = addDaysUtc(endDateYmd, 0);
      const meetingDeadlineObj = addDaysUtc(endDateYmd, 150);
      const closingDeadlineObj = addDaysUtc(endDateYmd, 30);
      const meetingMonthKey = meetingDeadlineObj.toISOString().slice(0, 7);

      return {
        c_code: row.c_code,
        c_name: row.c_name,
        c_group: row.c_group,
        coop_group: row.coop_group,
        endDateYmd,
        endDateThai: formatThaiDate(endDateObj),
        endDateMs: endDateObj.getTime(),
        meetingDeadlineYmd: meetingDeadlineObj.toISOString().slice(0, 10),
        meetingDeadlineThai: formatThaiDate(meetingDeadlineObj),
        meetingDeadlineMs: meetingDeadlineObj.getTime(),
        meetingMonthKey,
        closingDeadlineThai: formatThaiDate(closingDeadlineObj),
        closingDeadlineMs: closingDeadlineObj.getTime()
      };
    })
    .filter(Boolean);

  const bigmeetTargetRows = rowsWithDeadlines.filter((row) => row.meetingMonthKey === thisMonthKey);
  const meetingCodes = bigmeetTargetRows.map((row) => row.c_code).filter(Boolean);
  const bigmeetRows = await bigmeetModel.findByCodes(meetingCodes);
  const bigmeetMap = bigmeetRows.reduce((acc, row) => {
    const key = row.big_code || '';
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      dateMs: parseDateToUtcMs(row.big_date),
      status: row.big_meeting_status || '',
      fiscalEndDate: normalizeDateKey(row.big_fiscal_end_date),
      deadlineDate: normalizeDateKey(row.big_deadline_date)
    });
    return acc;
  }, {});

  const bigmeetThisMonthRows = bigmeetTargetRows
    .map((row) => {
      const inWindow = (bigmeetMap[row.c_code] || [])
        .filter((item) =>
          item.fiscalEndDate === row.endDateYmd ||
          item.deadlineDate === row.meetingDeadlineYmd ||
          (item.dateMs !== null && item.dateMs >= row.endDateMs && item.dateMs <= row.meetingDeadlineMs)
        )
        .sort((a, b) => (a.dateMs || Number.MAX_SAFE_INTEGER) - (b.dateMs || Number.MAX_SAFE_INTEGER));
      const metRecord = inWindow.find((item) => item.dateMs !== null && item.status !== 'not_met');
      return {
        ...row,
        meetingDateThai: metRecord ? formatThaiDate(new Date(metRecord.dateMs)) : null,
        meetingRecordedStatus: inWindow[0]?.status || null
      };
    })
    .sort((a, b) => a.meetingDeadlineMs - b.meetingDeadlineMs);

  const closingWithin30Rows = rowsWithDeadlines
    .filter((row) => row.closingDeadlineMs >= todayStartMs && row.closingDeadlineMs <= inThirtyDaysMs)
    .sort((a, b) => a.closingDeadlineMs - b.closingDeadlineMs);

  return {
    bigmeetThisMonthGroups: groupByCoopGroup(bigmeetThisMonthRows),
    closingWithin30Groups: groupByCoopGroup(closingWithin30Rows),
    bigmeetMonthLabel: monthLabel,
    closingWindowLabel: '30 วันข้างหน้า'
  };
}

async function showMain(req, res) {
  if (req.session.user) {
    return res.redirect(getLandingPath(req.session.user));
  }

  try {
    const [deadlineData, institutionRows] = await Promise.all([
      getMainDeadlineData(),
      activeCoopModel.getActiveInstitutionSummaryRows()
    ]);
    return res.render('main', {
      title: 'หน้าแรกระบบ CoopChain',
      returnTo: '',
      institutionSummary: buildInstitutionSummary(institutionRows),
      ...deadlineData
    });
  } catch (error) {
    console.error('[homeRoutes] main deadline data error:', error);
    return res.render('main', {
      title: 'หน้าแรกระบบ CoopChain',
      returnTo: '',
      bigmeetThisMonthGroups: [],
      closingWithin30Groups: [],
      bigmeetMonthLabel: '',
      closingWindowLabel: '30 วันข้างหน้า',
      institutionSummary: buildInstitutionSummary([])
    });
  }
}

// Define routes
router.get('/', noCache, showMain);
router.get('/main', noCache, showMain);
router.get('/home', requireLogin, homeController.index);
router.get('/homecoop', requireLogin, (req, res) => {
  res.render('homecoop', {
    title: 'หน้าหลักสมาชิกสถาบัน',
    user: req.session.user
  });
});

module.exports = router;
