// routes/homeRoutes.js

const express = require('express');
const router = express.Router();
const activeCoopModel = require('../models/activeCoopModel');
const bigmeetModel = require('../models/bigmeetModel');
const onlineModel = require('../models/onlineModel');
const turnoverModel = require('../models/turnoverModel');
const strengthModel = require('../models/strengthModel');
const downModel = require('../models/downModel');
const { requireLogin, noCache } = require('../middlewares/authMiddleware');

function getLandingPath(user) {
  const group = String(user?.group || user?.m_group || '').trim().toLowerCase();
  const mClass = String(user?.mClass || user?.m_class || '').trim().toLowerCase();
  return ['coop', 'group'].includes(group) || ['c', 'g'].includes(mClass) ? '/dashboard2' : '/dashboard';
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

function buildFiscalYearRange(fiscalYear) {
  const year = Number(fiscalYear || 0);
  if (!year) return null;
  return {
    start: `${year - 544}-10-01`,
    end: `${year - 543}-09-30`
  };
}

function buildAccountingEndRange(fiscalYear) {
  const year = Number(fiscalYear || 0);
  if (!year) return null;
  return {
    start: `${year - 544}-04-30`,
    end: `${year - 543}-03-31`
  };
}

function getAccountingEndYmdForFiscalYear(monthDay, fiscalYear) {
  const range = buildAccountingEndRange(fiscalYear);
  if (!range || !/^\d{2}-\d{2}$/.test(String(monthDay || ''))) return null;
  const startMonthDay = range.start.slice(5);
  const endMonthDay = range.end.slice(5);
  if (monthDay >= startMonthDay) return `${range.start.slice(0, 4)}-${monthDay}`;
  if (monthDay <= endMonthDay) return `${range.end.slice(0, 4)}-${monthDay}`;
  return null;
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

function buildMainDownloads(rows = []) {
  return (rows || []).map((row) => {
    const hasFile = Boolean(row.down_file && row.down_file !== '-');
    const hasLink = Boolean(row.down_link && row.down_link !== '-');
    const savedMs = parseDateToUtcMs(row.down_savedate);
    return {
      down_id: row.down_id,
      down_subject: row.down_subject || '-',
      down_group: row.down_group || '',
      down_type: row.down_type || '',
      down_for: row.down_for || '',
      down_file: row.down_file || '',
      down_link: row.down_link || '',
      hasFile,
      hasLink,
      downloadUrl: hasFile ? `/down/download/${row.down_id}` : hasLink ? row.down_link : '',
      savedDateThai: savedMs !== null ? formatThaiDate(new Date(savedMs)) : ''
    };
  });
}

function formatTurnoverMonth(value) {
  const thaiMonths = {
    1: 'มกราคม',
    2: 'กุมภาพันธ์',
    3: 'มีนาคม',
    4: 'เมษายน',
    5: 'พฤษภาคม',
    6: 'มิถุนายน',
    7: 'กรกฎาคม',
    8: 'สิงหาคม',
    9: 'กันยายน',
    10: 'ตุลาคม',
    11: 'พฤศจิกายน',
    12: 'ธันวาคม'
  };
  const trimmed = String(value || '').trim();
  const monthNumber = Number(trimmed);
  return thaiMonths[monthNumber] || trimmed;
}

function buildTurnoverCategorySummary(rows = []) {
  const categories = {
    agri: {
      key: 'agri',
      label: 'สหกรณ์ภาคการเกษตร',
      shortLabel: 'ภาคการเกษตร',
      icon: 'bi-flower1',
      tone: 'green',
      totalAmount: 0,
      institutionCount: 0,
      monthsWithData: 0,
      latestMonth: '',
      latestYear: ''
    },
    non_agri: {
      key: 'non_agri',
      label: 'สหกรณ์นอกภาคการเกษตร',
      shortLabel: 'นอกภาคการเกษตร',
      icon: 'bi-buildings',
      tone: 'teal',
      totalAmount: 0,
      institutionCount: 0,
      monthsWithData: 0,
      latestMonth: '',
      latestYear: ''
    },
    farmer: {
      key: 'farmer',
      label: 'กลุ่มเกษตรกร',
      shortLabel: 'กลุ่มเกษตรกร',
      icon: 'bi-people',
      tone: 'amber',
      totalAmount: 0,
      institutionCount: 0,
      monthsWithData: 0,
      latestMonth: '',
      latestYear: ''
    }
  };

  const validRows = (rows || [])
    .map((row) => ({
      budYear: Number(row.tur_budyear || 0),
      categoryKey: categories[row.category_key] ? row.category_key : 'non_agri',
      totalAmount: Number(row.total_amount || 0),
      institutionCount: Number(row.institution_count || 0),
      monthsWithData: Number(row.months_with_data || 0),
      latestMonth: formatTurnoverMonth(row.latest_month),
      latestYear: row.latest_year || ''
    }))
    .filter((row) => row.budYear);

  const latestBudYear = validRows.reduce((latest, row) => Math.max(latest, row.budYear), 0);

  validRows
    .filter((row) => row.budYear === latestBudYear)
    .forEach((row) => {
      const target = categories[row.categoryKey];
      target.totalAmount = row.totalAmount;
      target.institutionCount = row.institutionCount;
      target.monthsWithData = row.monthsWithData;
      target.latestMonth = row.latestMonth;
      target.latestYear = row.latestYear;
    });

  const list = ['agri', 'non_agri', 'farmer'].map((key) => categories[key]);
  const totalAmount = list.reduce((sum, item) => sum + item.totalAmount, 0);

  return {
    latestBudYear,
    latestBudYearThai: latestBudYear ? latestBudYear + 543 : '',
    totalAmount,
    list
  };
}

function buildStrengthGradeSummary(rows = [], year = 2568) {
  const categories = {
    'สหกรณ์ภาคการเกษตร': {
      key: 'agri',
      label: 'สหกรณ์ภาคการเกษตร',
      shortLabel: 'ภาคการเกษตร',
      icon: 'bi-flower1',
      tone: 'green',
      total: 0,
      grade1: 0,
      grade2: 0,
      grade3: 0
    },
    'สหกรณ์นอกภาคการเกษตร': {
      key: 'non_agri',
      label: 'สหกรณ์นอกภาค',
      shortLabel: 'นอกภาค',
      icon: 'bi-buildings',
      tone: 'teal',
      total: 0,
      grade1: 0,
      grade2: 0,
      grade3: 0
    },
    'สหกรณ์นอกภาค': {
      key: 'non_agri',
      label: 'สหกรณ์นอกภาค',
      shortLabel: 'นอกภาค',
      icon: 'bi-buildings',
      tone: 'teal',
      total: 0,
      grade1: 0,
      grade2: 0,
      grade3: 0
    },
    'กลุ่มเกษตรกร': {
      key: 'farmer',
      label: 'กลุ่มเกษตรกร',
      shortLabel: 'กลุ่มเกษตรกร',
      icon: 'bi-people',
      tone: 'amber',
      total: 0,
      grade1: 0,
      grade2: 0,
      grade3: 0
    }
  };

  const summaryByKey = {
    agri: { ...categories['สหกรณ์ภาคการเกษตร'] },
    non_agri: { ...categories['สหกรณ์นอกภาค'] },
    farmer: { ...categories['กลุ่มเกษตรกร'] }
  };

  (rows || []).forEach((row) => {
    const template = categories[String(row.group_name || '').trim()];
    if (!template) return;
    const target = summaryByKey[template.key];
    target.total = Number(row.total_count || 0);
    target.grade1 = Number(row.grade_1_count || 0);
    target.grade2 = Number(row.grade_2_count || 0);
    target.grade3 = Number(row.grade_3_count || 0);
  });

  const list = ['agri', 'non_agri', 'farmer'].map((key) => {
    const item = summaryByKey[key];
    return {
      ...item,
      grade1Percent: item.total > 0 ? (item.grade1 / item.total) * 100 : 0
    };
  });

  return {
    year,
    list,
    totals: list.reduce((acc, item) => {
      acc.total += item.total;
      acc.grade1 += item.grade1;
      acc.grade2 += item.grade2;
      acc.grade3 += item.grade3;
      return acc;
    }, { total: 0, grade1: 0, grade2: 0, grade3: 0 })
  };
}

function buildClosingCurrentMonthSummary(rows = [], monthLabel = '') {
  const summaryByKey = {
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

  (rows || []).forEach((row) => {
    const categoryKey = getInstitutionCategory(row);
    const target = summaryByKey[categoryKey] || summaryByKey.non_agri;
    target.count += 1;
    target.rows.push(row);
  });

  const list = ['agri', 'non_agri', 'farmer'].map((key) => {
    const item = summaryByKey[key];
    item.rows.sort((a, b) => a.closingDeadlineMs - b.closingDeadlineMs);
    return item;
  });

  return {
    monthLabel,
    total: list.reduce((sum, item) => sum + item.count, 0),
    list
  };
}

function buildOverdueMeetingSummary(rows = [], fiscalYear = 2569) {
  const summaryByKey = {
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

  (rows || []).forEach((row) => {
    const categoryKey = getInstitutionCategory(row);
    const target = summaryByKey[categoryKey] || summaryByKey.non_agri;
    target.count += 1;
    target.rows.push(row);
  });

  const list = ['agri', 'non_agri', 'farmer'].map((key) => {
    const item = summaryByKey[key];
    item.rows.sort((a, b) => a.meetingDeadlineMs - b.meetingDeadlineMs);
    return item;
  });

  return {
    fiscalYear,
    total: list.reduce((sum, item) => sum + item.count, 0),
    list
  };
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

function getDeadlineYearForEndDay(monthDay, currentYear, currentMonthDay) {
  if (!monthDay) return currentYear;
  return monthDay <= currentMonthDay ? currentYear : currentYear - 1;
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
  const overdueFiscalYear = 2569;
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
  const currentMonthDay = `${bangkokParts.month}-${bangkokParts.day}`;
  const monthLabel = now.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok'
  });

  const rowsWithDeadlines = (baseRows || [])
    .map((row) => {
      const monthDay = toMonthDay(row.end_day);
      if (!monthDay) return null;
      const endDateYear = getDeadlineYearForEndDay(monthDay, currentYear, currentMonthDay);
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
        in_out_group: row.in_out_group,
        endDateYmd,
        endDateThai: formatThaiDate(endDateObj),
        endDateMs: endDateObj.getTime(),
        meetingDeadlineYmd: meetingDeadlineObj.toISOString().slice(0, 10),
        meetingDeadlineThai: formatThaiDate(meetingDeadlineObj),
        meetingDeadlineMs: meetingDeadlineObj.getTime(),
        meetingMonthKey,
        closingDeadlineYmd: closingDeadlineObj.toISOString().slice(0, 10),
        closingMonthKey: closingDeadlineObj.toISOString().slice(0, 7),
        closingDeadlineThai: formatThaiDate(closingDeadlineObj),
        closingDeadlineMs: closingDeadlineObj.getTime()
      };
    })
    .filter(Boolean);

  const overdueFiscalRange = buildFiscalYearRange(overdueFiscalYear);
  const overdueMeetingCandidates = (baseRows || [])
    .map((row) => {
      const monthDay = toMonthDay(row.end_day);
      const endDateYmd = getAccountingEndYmdForFiscalYear(monthDay, overdueFiscalYear);
      if (!endDateYmd || !overdueFiscalRange) return null;
      const endDateObj = addDaysUtc(endDateYmd, 0);
      const meetingDeadlineObj = addDaysUtc(endDateYmd, 150);
      const meetingDeadlineYmd = meetingDeadlineObj.toISOString().slice(0, 10);
      if (meetingDeadlineYmd < overdueFiscalRange.start || meetingDeadlineYmd > overdueFiscalRange.end) return null;
      if (meetingDeadlineObj.getTime() >= todayStartMs) return null;
      return {
        c_code: row.c_code,
        c_name: row.c_name,
        c_group: row.c_group,
        coop_group: row.coop_group,
        in_out_group: row.in_out_group,
        endDateYmd,
        endDateThai: formatThaiDate(endDateObj),
        endDateMs: endDateObj.getTime(),
        meetingDeadlineYmd,
        meetingDeadlineThai: formatThaiDate(meetingDeadlineObj),
        meetingDeadlineMs: meetingDeadlineObj.getTime()
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.meetingDeadlineMs - b.meetingDeadlineMs);

  const bigmeetTargetRows = rowsWithDeadlines.filter((row) => row.meetingMonthKey === thisMonthKey);
  const meetingCodes = Array.from(new Set([
    ...bigmeetTargetRows.map((row) => row.c_code).filter(Boolean),
    ...overdueMeetingCandidates.map((row) => row.c_code).filter(Boolean)
  ]));
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
  const overdueMeetingRows = overdueMeetingCandidates
    .filter((row) => {
      const inWindow = (bigmeetMap[row.c_code] || [])
        .filter((item) =>
          item.fiscalEndDate === row.endDateYmd ||
          item.deadlineDate === row.meetingDeadlineYmd ||
          (item.dateMs !== null && item.dateMs >= row.endDateMs && item.dateMs <= row.meetingDeadlineMs)
        );
      return !inWindow.some((item) => item.dateMs !== null && item.status !== 'not_met');
    });

  const closingWithin30Rows = rowsWithDeadlines
    .filter((row) => row.closingDeadlineMs >= todayStartMs && row.closingDeadlineMs <= inThirtyDaysMs)
    .sort((a, b) => a.closingDeadlineMs - b.closingDeadlineMs);
  const closingCurrentMonthRows = closingWithin30Rows
    .filter((row) => row.closingMonthKey === thisMonthKey);

  return {
    bigmeetThisMonthGroups: groupByCoopGroup(bigmeetThisMonthRows),
    overdueMeetingSummary: buildOverdueMeetingSummary(overdueMeetingRows, overdueFiscalYear),
    closingWithin30Groups: groupByCoopGroup(closingWithin30Rows),
    closingCurrentMonthSummary: buildClosingCurrentMonthSummary(closingCurrentMonthRows, monthLabel),
    bigmeetMonthLabel: monthLabel,
    closingWindowLabel: '30 วันข้างหน้า'
  };
}

async function showMain(req, res) {
  if (req.session.user && req.path !== '/main') {
    return res.redirect(getLandingPath(req.session.user));
  }

  try {
    const [deadlineData, institutionRows, onlineUsers, onlineCount, turnoverCategoryRows, bigmeetFiscalSummary, strengthGradeRows, mainDownloads] = await Promise.all([
      getMainDeadlineData(),
      activeCoopModel.getActiveInstitutionSummaryRows(),
      onlineModel.getOnlineUsers(),
      onlineModel.getOnlineCount(),
      turnoverModel.getCategorySummaryByFiscalYear(),
      bigmeetModel.getLatestFiscalYearCategorySummary(),
      strengthModel.getGradeSummaryByInOutGroup(2568),
      downModel.getMainDownloads(8)
    ]);
    return res.render('main', {
      title: 'หน้าแรกระบบ CoopChain',
      returnTo: '',
      institutionSummary: buildInstitutionSummary(institutionRows),
      turnoverCategorySummary: buildTurnoverCategorySummary(turnoverCategoryRows),
      bigmeetFiscalSummary,
      strengthGradeSummary: buildStrengthGradeSummary(strengthGradeRows, 2568),
      mainDownloads: buildMainDownloads(mainDownloads),
      onlineUsers,
      onlineCount,
      ...deadlineData
    });
  } catch (error) {
    console.error('[homeRoutes] main deadline data error:', error);
    return res.render('main', {
      title: 'หน้าแรกระบบ CoopChain',
      returnTo: '',
      bigmeetThisMonthGroups: [],
      overdueMeetingSummary: buildOverdueMeetingSummary([], 2569),
      closingWithin30Groups: [],
      closingCurrentMonthSummary: buildClosingCurrentMonthSummary([], ''),
      bigmeetMonthLabel: '',
      closingWindowLabel: '30 วันข้างหน้า',
      institutionSummary: buildInstitutionSummary([]),
      turnoverCategorySummary: buildTurnoverCategorySummary([]),
      bigmeetFiscalSummary: { fiscalYear: 0, fiscalYearThai: '', categories: [] },
      strengthGradeSummary: buildStrengthGradeSummary([], 2568),
      mainDownloads: [],
      onlineUsers: [],
      onlineCount: 0
    });
  }
}

// Define routes
router.get('/', noCache, showMain);
router.get('/main', noCache, showMain);
router.get('/home', requireLogin, (req, res) => res.redirect('/dashboard'));
router.get('/homecoop', requireLogin, (req, res) => {
  res.render('homecoop', {
    title: 'หน้าหลักสมาชิกสถาบัน',
    user: req.session.user
  });
});

module.exports = router;
