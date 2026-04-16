const pool = require('../config/db'); 
const activeCoopModel = require('../models/activeCoopModel');
const bigmeetModel = require('../models/bigmeetModel');
// (removed) const puppeteer = require('puppeteer');
const path = require('path');
const PdfPrinter = require('pdfmake');
const buildDocDefinition = require('../templates/pdf/activeCoopEndDate');

exports.index = async (req, res) => {
  const search = req.query.search || '';
  const group = req.query.group || 'all';
  const status = req.query.status || 'all';
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const coops = await activeCoopModel.getAll(search, group, status, limit, offset);
  const total = await activeCoopModel.countAll(search, group, status);
  const totalPages = Math.ceil(total / limit);

  res.render('activeCoop/index', { coops, search, group, status, page, totalPages });
};

exports.createForm = (req, res) => {
  res.render('activeCoop/create');
};

exports.store = async (req, res) => {
  delete req.body.gmem;
  delete req.body.mastatan;
  delete req.body.c_standard;
  delete req.body.c_standard65;
  delete req.body.yokradab;
  delete req.body.plan;
  await activeCoopModel.create(req.body);
  res.redirect('/activeCoop');
};

exports.editForm = async (req, res) => {
  const coop = await activeCoopModel.getById(req.params.id);

  // ดึงรายชื่อสมาชิก member3
  const [members] = await pool.query('SELECT m_name FROM member3 ORDER BY m_name ASC');

  res.render('activeCoop/edit', { coop, members });
};

exports.update = async (req, res) => {
  delete req.body.gmem;
  delete req.body.mastatan;
  delete req.body.c_standard;
  delete req.body.c_standard65;
  delete req.body.yokradab;
  delete req.body.plan;
  req.body.c_saveby = req.session.user.fullname;
  req.body.c_savedate = new Date().toISOString().split('T')[0];
  await activeCoopModel.update(req.params.id, req.body);
  res.redirect('/activeCoop');
};

exports.delete = async (req, res) => {
  await activeCoopModel.remove(req.params.id);
  res.redirect('/activeCoop'); // จาก '/active-coop'
};

exports.listByEndDate = async (req, res) => {
  try {
    const groups = await activeCoopModel.getAllGroupedByEndDate();
    res.render('activeCoop/list', { groups });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error loading data');
  }
};

// Replace Puppeteer version by delegating to wkhtmltopdf version
exports.exportEndDatePdf = async (req, res) => {
  return exports.exportEndDatePdfWk(req, res);
};

exports.exportEndDatePdfWk = async (req, res) => {
  // Lazy-require wkhtmltopdf and fallback if missing
  let wkhtmltopdf;
  try {
    wkhtmltopdf = require('wkhtmltopdf');
  } catch (e) {
    console.warn('wkhtmltopdf not installed. Falling back to pdfmake.');
    return exports.exportEndDatePdfMake(req, res);
  }

  try {
    const groups = await activeCoopModel.getAllGroupedByEndDate();

    const html = await new Promise((resolve, reject) => {
      res.render('activeCoop/list-pdf', { groups }, (err, rendered) => {
        if (err) return reject(err);
        resolve(rendered);
      });
    });

    if (process.env.WKHTMLTOPDF_PATH) {
      wkhtmltopdf.command = process.env.WKHTMLTOPDF_PATH; // e.g. /usr/bin/wkhtmltopdf
    }

    res.setTimeout(120000);

    // สร้างสตรีมแล้วเก็บเป็นบัฟเฟอร์
    const pdfStream = wkhtmltopdf(html, {
      pageSize: 'A4',
      marginTop: '12mm',
      marginRight: '10mm',
      marginBottom: '12mm',
      marginLeft: '10mm',
      printMediaType: true,
      enableLocalFileAccess: true,
      disableSmartShrinking: true
    });

    const chunks = [];
    let aborted = false;

    req.on('aborted', () => {
      aborted = true;
      try { pdfStream.destroy(new Error('client aborted')); } catch {}
    });

    pdfStream.on('data', c => chunks.push(c));
    pdfStream.on('error', err => {
      console.error('wkhtmltopdf stream error:', err);
      if (!res.headersSent) res.status(500).send('ไม่สามารถสร้าง PDF ได้');
    });
    pdfStream.on('end', () => {
      if (aborted) return;
      const buf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Content-Disposition', 'inline; filename="active_coop_enddate.pdf"');
      res.end(buf);
    });
  } catch (e) {
    console.error('WK PDF error:', e);
    res.status(500).send('ไม่สามารถสร้าง PDF ได้');
  }
};

exports.exportEndDatePdfMake = async (req, res) => {
  try {
    const groups = await activeCoopModel.getAllGroupedByEndDate();

    const fonts = {
      THSarabun: {
        normal: path.join(__dirname, '../fonts/THSarabunNew.ttf'),
        bold: path.join(__dirname, '../fonts/THSarabunNew-Bold.ttf'),
        italics: path.join(__dirname, '../fonts/THSarabunNew-Italic.ttf'),
        bolditalics: path.join(__dirname, '../fonts/THSarabunNew-BoldItalic.ttf'),
      },
    };
    const printer = new PdfPrinter(fonts);

    // แยกหน้าเป็นปีละหน้า
    const docDefinition = buildDocDefinition(groups, { pageBreakByYear: true });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="active_coop_enddate.pdf"');
    pdfDoc.on('error', (err) => {
      console.error('pdfmake error:', err);
      if (!res.headersSent) res.status(500).send('ไม่สามารถสร้าง PDF ได้');
    });
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (e) {
    console.error('pdfmake export error:', e);
    res.status(500).send('ไม่สามารถสร้าง PDF ได้');
  }
};

// NEW: ดึงรายชื่อสหกรณ์หรือกลุ่มเกษตรกรตาม group (สำหรับ modal หน้าแรก)
exports.listGroupItems = async (req, res) => {
  try {
    const group = req.params.group; // e.g. group1
    const type = req.query.type; // 'สหกรณ์' หรือ 'กลุ่มเกษตรกร' หรือไม่ระบุ
    let sql = `SELECT c_id, c_code, c_name, coop_group FROM active_coop WHERE c_group = ? AND c_status = 'ดำเนินการ'`;
    const params = [group];
    if (type && (type === 'สหกรณ์' || type === 'กลุ่มเกษตรกร')) {
      sql += ' AND coop_group = ?';
      params.push(type);
    }
    sql += ' ORDER BY c_name ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ group, type: type || 'all', items: rows });
  } catch (e) {
    console.error('listGroupItems error:', e);
    res.status(500).json({ error: 'server error' });
  }
};

const resolveYearForEndDay = (monthDay, yearNow) => {
  if (!monthDay) return yearNow;
  const month = Number(monthDay.split('-')[0]);
  if (Number.isNaN(month)) return yearNow;
  return month >= 4 ? yearNow - 1 : yearNow;
};

exports.meetingGroupDetail = async (req, res) => {
  try {
    const group = req.params.group;
    const rows = await activeCoopModel.getMeetingDeadlineBase();
    const bangkokNow = new Date();
    const currentYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(bangkokNow));
    const bangkokMonthKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit'
    }).format(bangkokNow);
    const nextBangkokDate = new Date(bangkokNow.getTime());
    nextBangkokDate.setMonth(nextBangkokDate.getMonth() + 1);
    const nextBangkokMonthKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit'
    }).format(nextBangkokDate);

    const meetingDeadlines = (rows || [])
      .map((row) => {
        const monthDay = toMonthDay(row.end_day);
        if (!monthDay) return null;
        const endDateYear = resolveYearForEndDay(monthDay, currentYear);
        const endDateYmd = `${endDateYear}-${monthDay}`;
        const endDateObj = addDaysUtc(endDateYmd, 0);
        const deadlineObj = addDaysUtc(endDateYmd, 150);
        const deadlineMonthKey = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit'
        }).format(deadlineObj);
        return {
          ...row,
          endDateYmd,
          endDateThai: formatThaiDate(endDateObj),
          deadlineYmd: deadlineObj.toISOString().slice(0, 10),
          deadlineThai: formatThaiDate(deadlineObj),
          deadlineMs: deadlineObj.getTime(),
          deadlineMonthKey,
          endDateMs: endDateObj.getTime()
        };
      })
      .filter(Boolean)
      .filter((row) => row.deadlineMonthKey === bangkokMonthKey || row.deadlineMonthKey === nextBangkokMonthKey);

    const meetingCodes = meetingDeadlines.map((row) => row.c_code).filter(Boolean);
    const bigmeetRows = await bigmeetModel.findByCodes(meetingCodes);
    const bigmeetMap = bigmeetRows.reduce((acc, row) => {
      const key = row.big_code || '';
      const ms = parseDateToUtcMs(row.big_date);
      if (!key || ms === null) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(ms);
      return acc;
    }, {});

    const results = meetingDeadlines
      .map((row) => {
        const dates = (bigmeetMap[row.c_code] || []).filter((ms) => ms >= row.endDateMs && ms <= row.deadlineMs).sort();
        return {
          ...row,
          meetingDateThai: dates.length ? formatThaiDate(new Date(dates[0])) : null
        };
      })
      .filter((item) => group === 'all' ? true : item.c_group === group)
      .sort((a, b) => a.deadlineMs - b.deadlineMs || a.c_name.localeCompare(b.c_name, 'th-TH'));

    res.render('activeCoop/meeting-group', {
      group,
      groupLabel: getGroupLabel(group),
      rows: results,
    });
  } catch (e) {
    console.error('meetingGroupDetail error:', e);
    res.status(500).send('ไม่สามารถโหลดข้อมูลหน้าได้');
  }
};

const toMonthDay = (value) => {
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
};

const addDaysUtc = (ymd, days) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const parseDateToUtcMs = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const ymd = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const [y, m, d] = ymd.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  return null;
};

const formatThaiDate = (date) => date.toLocaleDateString('th-TH', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Bangkok'
});

const getGroupLabel = (groupName) => {
  switch (groupName) {
    case 'group1': return 'กลุ่มส่งเสริมสหกรณ์ 1';
    case 'group2': return 'กลุ่มส่งเสริมสหกรณ์ 2';
    case 'group3': return 'กลุ่มส่งเสริมสหกรณ์ 3';
    case 'group4': return 'กลุ่มส่งเสริมสหกรณ์ 4';
    case 'group5': return 'กลุ่มส่งเสริมสหกรณ์ 5';
    case 'all': return 'ทุกกลุ่ม';
    default: return groupName || 'ไม่ระบุกลุ่ม';
  }
};

exports.closingGroupDetail = async (req, res) => {
  try {
    const group = req.params.group;
    const rows = await activeCoopModel.getMeetingDeadlineBase();
    const bangkokNow = new Date();
    const nowMs = Date.UTC(
      Number(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Bangkok', year:'numeric' }).format(bangkokNow)),
      Number(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Bangkok', month:'2-digit' }).format(bangkokNow)) - 1,
      Number(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Bangkok', day:'2-digit' }).format(bangkokNow))
    );
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const results = rows
      .map((row) => {
        const monthDay = toMonthDay(row.end_day);
        if (!monthDay) return null;
        const endDateYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Bangkok', year:'numeric' }).format(bangkokNow));
        const endDateYmd = `${endDateYear}-${monthDay}`;
        const closingDeadlineObj = addDaysUtc(endDateYmd, 30);
        const closingMs = closingDeadlineObj.getTime();
        if (closingMs < nowMs || closingMs > nowMs + thirtyDaysMs) return null;
        return {
          ...row,
          closingDeadlineYmd: closingDeadlineObj.toISOString().slice(0, 10),
          closingDeadlineThai: formatThaiDate(closingDeadlineObj),
          daysRemaining: Math.ceil((closingMs - nowMs) / (1000 * 60 * 60 * 24)),
          groupLabel: getGroupLabel(row.c_group)
        };
      })
      .filter(Boolean)
      .filter((item) => group === 'all' ? true : item.c_group === group)
      .sort((a, b) => a.daysRemaining - b.daysRemaining || a.c_name.localeCompare(b.c_name, 'th-TH'));

    res.render('activeCoop/closing-group', {
      group,
      groupLabel: getGroupLabel(group),
      rows: results,
    });
  } catch (e) {
    console.error('closingGroupDetail error:', e);
    res.status(500).send('ไม่สามารถโหลดข้อมูลหน้าได้');
  }
};