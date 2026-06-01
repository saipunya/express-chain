const fs = require('fs');
const ExcelJS = require('exceljs');
const db = require('../config/db');
const Bigmeet = require('../models/bigmeetModel');

const requiredFields = ['big_code', 'big_endyear', 'big_type', 'big_meeting_status'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeText(value) {
  return isBlank(value) ? '' : String(value).trim();
}

function normalizeBuddhistYear(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  if (num > 0 && num < 2400) return String(num + 543);
  return String(Math.trunc(num));
}

function getBudgetYearFromDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(String(value).includes('T') ? String(value) : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() >= 9 ? d.getFullYear() + 544 : d.getFullYear() + 543;
}

function getCurrentBudgetYear(date = new Date()) {
  return getBudgetYearFromDate(date);
}

function budgetYearToDateYear(monthDay, budgetYear) {
  const md = normalizeText(monthDay);
  const by = parseInt(budgetYear, 10);
  if (!md || !by || Number.isNaN(by)) return null;
  const month = parseInt(md.slice(0, 2), 10);
  if (!Number.isFinite(month)) return null;
  return month >= 10 ? by - 544 : by - 543;
}

function budgetYearSqlExpr(alias = 'b') {
  return `CASE
    WHEN COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date) IS NULL THEN NULL
    WHEN MONTH(COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date)) >= 10
      THEN YEAR(COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date)) + 544
    ELSE YEAR(COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date)) + 543
  END`;
}

function normalizeKey(value) {
  return normalizeText(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeDateOnly(value) {
  if (isBlank(value)) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

const THAI_MONTH_TO_MM = {
  มกราคม: '01',
  กุมภาพันธ์: '02',
  มีนาคม: '03',
  เมษายน: '04',
  พฤษภาคม: '05',
  มิถุนายน: '06',
  กรกฎาคม: '07',
  สิงหาคม: '08',
  กันยายน: '09',
  ตุลาคม: '10',
  พฤศจิกายน: '11',
  ธันวาคม: '12',
};

function addDaysIso(isoDate, days) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function deriveMonthDayFromCoop(coop = {}) {
  const endDay = normalizeText(coop.end_day);
  if (/^\d{2}-\d{2}$/.test(endDay)) return endDay;

  const endDate = normalizeText(coop.end_date);
  const text = endDate.replace(/\s+/g, '');
  const match = text.match(/^(\d{1,2})([^\d]+)$/);
  if (match) {
    const day = String(match[1]).padStart(2, '0');
    const monthName = match[2];
    const mm = THAI_MONTH_TO_MM[monthName];
    if (mm) return `${mm}-${day}`;
  }

  return null;
}

function deriveFiscalEndDateFromCoop(coop = {}, budgetYear = getCurrentBudgetYear()) {
  const monthDay = deriveMonthDayFromCoop(coop);
  if (!monthDay) return null;
  const dateYear = budgetYearToDateYear(monthDay, budgetYear);
  if (!dateYear) return null;
  return `${dateYear}-${monthDay}`;
}

function deriveDeadlineDateFromCoop(coop = {}, budgetYear = getCurrentBudgetYear()) {
  const fiscalEndDate = deriveFiscalEndDateFromCoop(coop, budgetYear);
  return fiscalEndDate ? addDaysIso(fiscalEndDate, 150) : null;
}

async function getCoopByCode(code) {
  const coops = await Bigmeet.allcoop();
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) return null;
  return coops.find((coop) => normalizeText(coop.c_code) === normalizedCode) || null;
}

function normalizeExcelDate(cellValue, cellText = '') {
  if (cellValue instanceof Date) {
    const d = new Date(cellValue);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getFullYear() >= 1900 && d.getFullYear() < 2000) {
      d.setFullYear(d.getFullYear() + 57);
    }
    return d.toISOString().slice(0, 10);
  }

  if (typeof cellValue === 'string') {
    const text = cellValue.trim();
    if (!text) return null;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  if (typeof cellText === 'string') {
    const parsed = new Date(cellText);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeMeetingStatus(value, meetingDate) {
  const status = normalizeText(value);
  if (status) return status;
  return meetingDate ? 'met_within_150' : 'not_met';
}

function validateCreate(body) {
  const missing = requiredFields.filter((field) => {
    if (field === 'big_meeting_status') return isBlank(body.big_meeting_status);
    return isBlank(body[field]);
  });

  if (normalizeText(body.big_meeting_status) !== 'not_met' && isBlank(body.big_date)) {
    missing.push('big_date');
  }

  return { valid: missing.length === 0, missing: [...new Set(missing)] };
}

async function normalizeFormPayload(body = {}) {
  const meetingDate = normalizeDateOnly(body.big_date);
  const meetingStatus = normalizeMeetingStatus(body.big_meeting_status, meetingDate);
  const coop = await getCoopByCode(body.big_code);
  const budgetYear = getCurrentBudgetYear();
  const fiscalEndDate = coop ? deriveFiscalEndDateFromCoop(coop, budgetYear) : normalizeDateOnly(body.big_fiscal_end_date);
  const deadlineDate = coop ? deriveDeadlineDateFromCoop(coop, budgetYear) : normalizeDateOnly(body.big_deadline_date);

  return {
    ...body,
    big_code: normalizeText(body.big_code),
    big_endyear: normalizeBuddhistYear(body.big_endyear),
    big_fiscal_end_date: fiscalEndDate,
    big_type: normalizeText(body.big_type),
    big_meeting_status: meetingStatus,
    big_deadline_date: deadlineDate,
    big_date: meetingStatus === 'not_met' ? null : meetingDate,
    big_reason: normalizeText(body.big_reason) || null,
    big_note: normalizeText(body.big_note) || null,
    big_saveby: normalizeText(body.big_saveby) || 'system',
    big_savedate: normalizeDateOnly(body.big_savedate) || new Date().toISOString().slice(0, 10),
  };
}

function validatePagination(page, limit) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;

  return {
    page: Math.max(1, pageNum),
    limit: Math.min(Math.max(1, limitNum), 100),
    offset: Math.max(0, offset),
  };
}

function fyRangeToIso(fyBE) {
  const fy = parseInt(fyBE, 10);
  if (!fy || Number.isNaN(fy)) return null;

  const startCEYear = (fy - 1) - 543;
  const endCEYear = fy - 543;

  return {
    start: `${startCEYear}-10-01`,
    end: `${endCEYear}-09-30`,
    fy,
  };
}

function fyAccountingEndRangeToIso(fyBE) {
  const fy = parseInt(fyBE, 10);
  if (!fy || Number.isNaN(fy)) return null;

  const startCEYear = fy - 544;
  const endCEYear = fy - 543;

  return {
    start: `${startCEYear}-04-30`,
    end: `${endCEYear}-03-31`,
    fy,
  };
}

function isoFromMonthDayInAccountingRange(monthDay, range) {
  const md = normalizeText(monthDay);
  if (!/^\d{2}-\d{2}$/.test(md) || !range) return null;
  const startMonthDay = range.start.slice(5);
  const endMonthDay = range.end.slice(5);
  const startYear = range.start.slice(0, 4);
  const endYear = range.end.slice(0, 4);

  if (md >= startMonthDay) return `${startYear}-${md}`;
  if (md <= endMonthDay) return `${endYear}-${md}`;
  return null;
}

function getCoopSummaryType(item = {}) {
  if (item.coop_group === 'กลุ่มเกษตรกร') return 'farmer';
  if (item.coop_group === 'สหกรณ์' && item.in_out_group === 'ใน') return 'agri';
  return 'non_agri';
}

function incrementSummaryType(summary, coopType, suffix) {
  if (coopType === 'agri') summary[`agri${suffix}`] += 1;
  if (coopType === 'non_agri') summary[`nonAgri${suffix}`] += 1;
  if (coopType === 'farmer') summary[`farmer${suffix}`] += 1;
}

const summaryTypeLabels = {
  agri: 'สหกรณ์ในภาค',
  non_agri: 'สหกรณ์นอกภาค',
  farmer: 'กลุ่มเกษตรกร',
};

function formatThaiDate(value) {
  if (!value) return '-';
  const d = value instanceof Date ? new Date(value) : new Date(String(value).includes('T') ? String(value) : `${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatThaiMonthDay(monthDay) {
  const md = normalizeText(monthDay);
  if (!/^\d{2}-\d{2}$/.test(md)) return '-';
  const monthNames = {
    '01': 'มกราคม',
    '02': 'กุมภาพันธ์',
    '03': 'มีนาคม',
    '04': 'เมษายน',
    '05': 'พฤษภาคม',
    '06': 'มิถุนายน',
    '07': 'กรกฎาคม',
    '08': 'สิงหาคม',
    '09': 'กันยายน',
    '10': 'ตุลาคม',
    '11': 'พฤศจิกายน',
    '12': 'ธันวาคม',
  };
  const [month, day] = md.split('-');
  return `${parseInt(day, 10)} ${monthNames[month] || month}`;
}

async function buildAccountingYearCounts() {
  const [activeCoops] = await db.query(`
    SELECT c.c_code, c.c_name, TRIM(c.end_date) AS end_date, TRIM(c.end_day) AS end_day,
           REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
           c.coop_group
    FROM active_coop c
    WHERE c.c_status = 'ดำเนินการ'
    ORDER BY c.c_code ASC
  `);

  const grouped = new Map();
  activeCoops.forEach((coop) => {
    const monthDay = deriveMonthDayFromCoop(coop);
    if (!monthDay) return;

    if (!grouped.has(monthDay)) {
      grouped.set(monthDay, {
        monthDay,
        label: formatThaiMonthDay(monthDay),
        total: 0,
        agriTotal: 0,
        nonAgriTotal: 0,
        farmerTotal: 0,
        items: [],
      });
    }

    const row = grouped.get(monthDay);
    const coopType = getCoopSummaryType(coop);
    row.total += 1;
    incrementSummaryType(row, coopType, 'Total');
    row.items.push({
      c_code: normalizeText(coop.c_code),
      c_name: normalizeText(coop.c_name),
      coopType,
      typeLabel: summaryTypeLabels[coopType] || coopType,
    });
  });

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    items: row.items.sort((a, b) => String(a.c_name || '').localeCompare(String(b.c_name || ''), 'th')),
  })).sort((a, b) => a.monthDay.localeCompare(b.monthDay));
}

async function buildFiscalYearMeetingSummary(fy) {
  const range = fyRangeToIso(fy);
  const accountingRange = fyAccountingEndRangeToIso(fy);
  if (!range || !accountingRange) return null;

  const [activeCoops] = await db.query(`
    SELECT c.c_code, c.c_name, TRIM(c.end_date) AS end_date, TRIM(c.end_day) AS end_day,
           REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
           c.coop_group
    FROM active_coop c
    WHERE c.c_status = 'ดำเนินการ'
    ORDER BY c.c_code ASC
  `);

  const [meetingRows] = await db.query(`
    SELECT b.*, c.c_name, TRIM(c.end_day) AS end_day,
           REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
           c.coop_group
    FROM bigmeet b
    LEFT JOIN active_coop c ON b.big_code = c.c_code
    WHERE (
      b.big_date BETWEEN ? AND ?
      OR (
        b.big_meeting_status = 'not_met'
        AND b.big_deadline_date BETWEEN ? AND ?
      )
    )
    ORDER BY b.big_date DESC, b.big_id DESC
  `, [range.start, range.end, range.start, range.end]);

  const summary = {
    fiscalYear: range.fy,
    range: { start: range.start, end: range.end },
    accountingRange: { start: accountingRange.start, end: accountingRange.end },
    totalCoopsInList: 0,
    agriTotal: 0,
    nonAgriTotal: 0,
    farmerTotal: 0,
    metInFiscalYear: 0,
    notMetInFiscalYear: 0,
    agriMet: 0,
    agriNotMet: 0,
    nonAgriMet: 0,
    nonAgriNotMet: 0,
    farmerMet: 0,
    farmerNotMet: 0,
  };

  const requiredByCode = new Map();
  activeCoops.forEach((coop) => {
    const monthDay = deriveMonthDayFromCoop(coop);
    const fiscalEndDate = isoFromMonthDayInAccountingRange(monthDay, accountingRange);
    if (!fiscalEndDate) return;

    const coopType = getCoopSummaryType(coop);
    requiredByCode.set(normalizeText(coop.c_code), {
      ...coop,
      fiscalEndDate,
      fiscalEndDateText: formatThaiDate(fiscalEndDate),
      coopType,
      typeLabel: summaryTypeLabels[coopType] || coopType,
    });
    summary.totalCoopsInList += 1;
    incrementSummaryType(summary, coopType, 'Total');
  });

  const latestMeetingByCode = new Map();
  meetingRows.forEach((item) => {
    const code = normalizeText(item.big_code);
    if (!requiredByCode.has(code)) return;
    if (String(item.big_meeting_status || '') === 'not_met') return;
    if (!latestMeetingByCode.has(code)) latestMeetingByCode.set(code, item);
  });

  latestMeetingByCode.forEach((item, code) => {
    const required = requiredByCode.get(code);
    summary.metInFiscalYear += 1;
    incrementSummaryType(summary, required.coopType, 'Met');
  });

  requiredByCode.forEach((required, code) => {
    if (latestMeetingByCode.has(code)) return;
    summary.notMetInFiscalYear += 1;
    incrementSummaryType(summary, required.coopType, 'NotMet');
  });

  const items = Array.from(requiredByCode.entries()).map(([code, required]) => {
    const meeting = latestMeetingByCode.get(code) || null;
    return {
      ...required,
      big_code: code,
      isMet: Boolean(meeting),
      meetingDate: meeting ? normalizeDateOnly(meeting.big_date) : null,
      meetingDateText: meeting ? formatThaiDate(meeting.big_date) : '-',
      meetingStatus: meeting ? meeting.big_meeting_status : 'not_met',
      reason: meeting ? meeting.big_reason : null,
      note: meeting ? meeting.big_note : null,
      saveBy: meeting ? meeting.big_saveby : null,
    };
  });

  items.sort((a, b) => {
    if (a.isMet !== b.isMet) return a.isMet ? -1 : 1;
    const dateA = a.meetingDate ? new Date(`${a.meetingDate}T00:00:00`).getTime() : 0;
    const dateB = b.meetingDate ? new Date(`${b.meetingDate}T00:00:00`).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return String(a.c_name || '').localeCompare(String(b.c_name || ''), 'th');
  });

  return { summary, items };
}

function detectMeetingDate(row) {
  return normalizeExcelDate(row.getCell(7).value, row.getCell(7).text);
}

function detectReason(row) {
  const raw = row.getCell(7).value;
  if (typeof raw === 'string') {
    const text = normalizeText(raw);
    if (text) return text;
  }

  const note = normalizeText(row.getCell(12).value);
  return note || null;
}

function getUploadMessage(req) {
  return req.query.message || req.query.success || req.query.import || '';
}

module.exports = {
  async list(req, res) {
    try {
      const items = await Bigmeet.findAll();

      res.render('bigmeet/list', {
        items,
        pagination: null,
        filters: {},
        message: getUploadMessage(req),
      });
    } catch (err) {
      console.error('bigmeet:list', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async apiList(req, res) {
    try {
      const { page = 1, limit = 10, search, year, type, meetingStatus, budgetYear } = req.query;
      const pagination = validatePagination(page, limit);

      const filters = {};
      if (search) filters.search = search;
      if (year) filters.year = year;
      if (type) filters.type = type;
      if (meetingStatus) filters.meetingStatus = meetingStatus;
      if (budgetYear) filters.budgetYear = budgetYear;

      const [items, total] = await Promise.all([
        Bigmeet.findPage(pagination.limit, pagination.offset, filters),
        Bigmeet.countAll(filters),
      ]);

      const totalPages = Math.ceil(total / pagination.limit);

      res.json({
        success: true,
        data: items,
        pagination: {
          currentPage: pagination.page,
          totalPages,
          totalItems: total,
          itemsPerPage: pagination.limit,
          hasNextPage: pagination.page < totalPages,
          hasPrevPage: pagination.page > 1,
        },
      });
    } catch (err) {
      console.error('bigmeet:apiList', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async createForm(req, res) {
    try {
      const [groups, coops] = await Promise.all([
        Bigmeet.allcoopGroups(),
        Bigmeet.allcoop(),
      ]);
      res.render('bigmeet/form', { item: null, errors: null, groups, coops });
    } catch (err) {
      console.error('bigmeet:createForm', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async editForm(req, res) {
    try {
      const [item, groups, coops] = await Promise.all([
        Bigmeet.findById(req.params.id),
        Bigmeet.allcoopGroups(),
        Bigmeet.allcoop(),
      ]);
      if (!item) {
        return res.status(404).render('error_page', { message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
      }
      res.render('bigmeet/form', { item, errors: null, groups, coops });
    } catch (err) {
      console.error('bigmeet:editForm', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async get(req, res) {
    try {
      const row = await Bigmeet.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) {
      console.error('bigmeet:get', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      req.body = await normalizeFormPayload(req.body || {});

      const { valid, missing } = validateCreate(req.body);
      if (!valid) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(400).json({
            success: false,
            error: 'กรุณากรอกข้อมูลให้ครบถ้วน: ' + missing.join(', '),
          });
        }

        const [groups, coops] = await Promise.all([
          Bigmeet.allcoopGroups(),
          Bigmeet.allcoop(),
        ]);
        return res.status(400).render('bigmeet/form', { item: req.body, errors: missing, groups, coops });
      }

      await Bigmeet.create(req.body);

      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.json({ success: true, message: 'สร้างข้อมูลสำเร็จ' });
      } else {
        res.redirect('/bigmeet?message=' + encodeURIComponent('สร้างข้อมูลสำเร็จ'));
      }
    } catch (err) {
      console.error('bigmeet:create', err);
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      } else {
        res.status(500).render('error_page', { message: 'Internal server error' });
      }
    }
  },

  async update(req, res) {
    try {
      req.body = await normalizeFormPayload(req.body || {});

      const exists = await Bigmeet.findById(req.params.id);
      if (!exists) {
        return req.xhr || req.headers.accept?.indexOf('json') > -1
          ? res.status(404).json({ success: false, error: 'ไม่พบข้อมูล' })
          : res.status(404).render('error_page', { message: 'ไม่พบข้อมูล' });
      }

      const { valid, missing } = validateCreate(req.body);
      if (!valid) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(400).json({
            success: false,
            error: 'กรุณากรอกข้อมูลให้ครบถ้วน: ' + missing.join(', '),
          });
        }

        const [groups, coops] = await Promise.all([
          Bigmeet.allcoopGroups(),
          Bigmeet.allcoop(),
        ]);
        return res.status(400).render('bigmeet/form', {
          item: { ...req.body, big_id: req.params.id },
          errors: missing,
          groups,
          coops,
        });
      }

      await Bigmeet.update(req.params.id, req.body);

      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
      } else {
        res.redirect('/bigmeet?message=' + encodeURIComponent('อัปเดตข้อมูลสำเร็จ'));
      }
    } catch (err) {
      console.error('bigmeet:update', err);
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      } else {
        res.status(500).render('error_page', { message: 'Internal server error' });
      }
    }
  },

  async remove(req, res) {
    try {
      const ok = await Bigmeet.remove(req.params.id);
      if (!ok) {
        return req.xhr || req.headers.accept?.indexOf('json') > -1
          ? res.status(404).json({ success: false, error: 'Not found' })
          : res.status(404).render('error_page', { message: 'Not found' });
      }

      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
      } else {
        res.redirect('/bigmeet?message=' + encodeURIComponent('ลบข้อมูลสำเร็จ'));
      }
    } catch (err) {
      console.error('bigmeet:remove', err);
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      } else {
        res.status(500).render('error_page', { message: 'Internal server error' });
      }
    }
  },

  async bulkCreate(req, res) {
    try {
      const { data } = req.body;

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid data array' });
      }

      const validationResults = data.map((item) => validateCreate(item));
      const invalidItems = validationResults.filter((result) => !result.valid);

      if (invalidItems.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: invalidItems.map((result, index) => ({ index, missing: result.missing })),
        });
      }

      const result = await Bigmeet.bulkCreate(data);
      res.json({ success: true, message: `สร้างข้อมูล ${result.affectedRows} รายการสำเร็จ`, result });
    } catch (err) {
      console.error('bigmeet:bulkCreate', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async bulkUpdate(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid updates array' });
      }

      const result = await Bigmeet.bulkUpdate(updates);
      res.json({ success: true, message: `อัปเดตข้อมูล ${result.updated} รายการสำเร็จ`, result });
    } catch (err) {
      console.error('bigmeet:bulkUpdate', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async bulkDelete(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid IDs array' });
      }

      const result = await Bigmeet.bulkDelete(ids);
      res.json({ success: true, message: `ลบข้อมูล ${result.affectedRows} รายการสำเร็จ`, result });
    } catch (err) {
      console.error('bigmeet:bulkDelete', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async summaryByFiscalYear(req, res) {
    try {
      const { fy } = req.query;
      const result = await buildFiscalYearMeetingSummary(fy);
      if (!result) {
        return res.status(400).json({ success: false, error: 'Invalid fiscal year (fy)' });
      }

      return res.json({
        success: true,
        data: result.summary,
      });
    } catch (err) {
      console.error('bigmeet:summaryByFiscalYear', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async accountingYearCounts(req, res) {
    try {
      const rows = await buildAccountingYearCounts();
      return res.json({
        success: true,
        data: rows.map(({ items, ...row }) => row),
        total: rows.reduce((sum, row) => sum + Number(row.total || 0), 0),
      });
    } catch (err) {
      console.error('bigmeet:accountingYearCounts', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async accountingYearCountDetail(req, res) {
    try {
      const monthDay = normalizeText(req.query.monthDay);
      const type = normalizeText(req.query.type || 'all');
      const validTypes = ['all', 'agri', 'non_agri', 'farmer'];

      if (!/^\d{2}-\d{2}$/.test(monthDay) || !validTypes.includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid accounting year filter' });
      }

      const rows = await buildAccountingYearCounts();
      const row = rows.find((item) => item.monthDay === monthDay);
      if (!row) {
        return res.json({
          success: true,
          data: {
            monthDay,
            label: formatThaiMonthDay(monthDay),
            type,
            typeLabel: type === 'all' ? 'ทั้งหมด' : summaryTypeLabels[type],
            items: [],
          },
        });
      }

      const items = type === 'all' ? row.items : row.items.filter((item) => item.coopType === type);
      return res.json({
        success: true,
        data: {
          monthDay: row.monthDay,
          label: row.label,
          type,
          typeLabel: type === 'all' ? 'ทั้งหมด' : summaryTypeLabels[type],
          items,
        },
      });
    } catch (err) {
      console.error('bigmeet:accountingYearCountDetail', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async summaryDetail(req, res) {
    try {
      const fy = req.query.fy || getCurrentBudgetYear();
      const type = normalizeText(req.query.type);
      const status = normalizeText(req.query.status);
      const validTypes = ['agri', 'non_agri', 'farmer'];
      const validStatuses = ['met', 'not_met'];

      const result = await buildFiscalYearMeetingSummary(fy);
      if (!result || !validTypes.includes(type) || !validStatuses.includes(status)) {
        return res.status(400).render('error_page', { message: 'Invalid summary detail filter' });
      }

      const items = result.items.filter((item) => {
        const matchesType = item.coopType === type;
        const matchesStatus = status === 'met' ? item.isMet : !item.isMet;
        return matchesType && matchesStatus;
      });

      return res.render('bigmeet/summary-detail', {
        title: 'รายละเอียดภาพรวมประชุมใหญ่',
        fiscalYear: result.summary.fiscalYear,
        summary: result.summary,
        items,
        type,
        status,
        typeLabel: summaryTypeLabels[type],
        statusLabel: status === 'met' ? 'มีการประชุมแล้ว' : 'ยังไม่พบผลประชุม',
      });
    } catch (err) {
      console.error('bigmeet:summaryDetail', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async importExcel(req, res) {
    try {
      if (!req.file) {
        return res.redirect('/bigmeet?message=' + encodeURIComponent('กรุณาเลือกไฟล์ Excel'));
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const sheet = workbook.worksheets[0];

      if (!sheet) {
        fs.unlink(req.file.path, () => {});
        return res.redirect('/bigmeet?message=' + encodeURIComponent('ไม่พบแผ่นงานในไฟล์ Excel'));
      }

      const coops = await Bigmeet.allcoop();
      const coopByName = new Map(coops.map((coop) => [normalizeKey(coop.c_name), coop]));
      const existing = await Bigmeet.findAll();
      const existingKeys = new Set(
        existing.map((row) => `${normalizeKey(row.big_code)}__${normalizeBuddhistYear(row.big_endyear)}`)
      );

      const rowsToInsert = [];
      const skipped = [];

      for (let rowNumber = 8; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const name = normalizeText(row.getCell(3).value);
        if (!name) continue;

        const coop = coopByName.get(normalizeKey(name));
        if (!coop) {
          skipped.push(`แถว ${rowNumber}: ไม่พบชื่อสหกรณ์/กลุ่มเกษตรกร (${name})`);
          continue;
        }

        const fiscalEndDate = deriveFiscalEndDateFromCoop(coop);
        if (!fiscalEndDate) {
          skipped.push(`แถว ${rowNumber}: ไม่พบวันสิ้นปีทางบัญชี (${name})`);
          continue;
        }

        const deadlineDate = addDaysIso(fiscalEndDate, 150);
        const meetingDate = detectMeetingDate(row);
        const reason = detectReason(row);
        const sheetType = normalizeText(row.getCell(4).value) || normalizeText(coop.in_out_group) || normalizeText(coop.coop_group);
        const meetingStatus = meetingDate
          ? (deadlineDate && meetingDate > deadlineDate ? 'met_over_150' : 'met_within_150')
          : 'not_met';
        const bigEndYear = String(new Date(fiscalEndDate).getFullYear() + 543);
        const key = `${normalizeKey(coop.c_code)}__${bigEndYear}`;

        if (existingKeys.has(key)) {
          skipped.push(`แถว ${rowNumber}: มีข้อมูลเดิมแล้ว (${name}, ปี ${bigEndYear})`);
          continue;
        }

        rowsToInsert.push({
          big_code: coop.c_code,
          big_endyear: normalizeBuddhistYear(bigEndYear),
          big_fiscal_end_date: fiscalEndDate,
          big_type: sheetType,
          big_meeting_status: meetingStatus,
          big_deadline_date: deadlineDate,
          big_date: meetingDate,
          big_reason: reason,
          big_note: normalizeText(row.getCell(12).value) || null,
          big_saveby: req.user?.username || req.session?.user?.username || 'system',
          big_savedate: new Date().toISOString().slice(0, 10),
        });

        existingKeys.add(key);
      }

      fs.unlink(req.file.path, () => {});

      if (rowsToInsert.length === 0) {
        const message = skipped.length ? skipped[0] : 'ไม่พบข้อมูลที่นำเข้าได้';
        return res.redirect('/bigmeet?message=' + encodeURIComponent(message));
      }

      const result = await Bigmeet.bulkCreate(rowsToInsert);
      const message = `นำเข้า ${rowsToInsert.length} รายการสำเร็จ${skipped.length ? ` (ข้าม ${skipped.length} รายการ)` : ''}`;
      return res.redirect('/bigmeet?message=' + encodeURIComponent(message));
    } catch (err) {
      console.error('bigmeet:importExcel', err);
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.redirect('/bigmeet?message=' + encodeURIComponent(err.message || 'นำเข้าไม่สำเร็จ'));
    }
  },
};
