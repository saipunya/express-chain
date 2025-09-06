const pool = require('../config/db'); 
const activeCoopModel = require('../models/activeCoopModel');
const puppeteer = require('puppeteer');
const wkhtmltopdf = require('wkhtmltopdf');
const path = require('path');

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
  await activeCoopModel.create(req.body);
  res.redirect('/active-coop');
};

exports.editForm = async (req, res) => {
  const coop = await activeCoopModel.getById(req.params.id);

  // ดึงรายชื่อสมาชิก member3
  const [members] = await pool.query('SELECT m_name FROM member3 ORDER BY m_name ASC');

  res.render('activeCoop/edit', { coop, members });
};

exports.update = async (req, res) => {
  await activeCoopModel.update(req.params.id, req.body);
  res.redirect('/activeCoop');
};

exports.delete = async (req, res) => {
  await activeCoopModel.remove(req.params.id);
  res.redirect('/active-coop');
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

exports.exportEndDatePdf = async (req, res) => {
  try {
    const groups = await activeCoopModel.getAllGroupedByEndDate();

    const html = await new Promise((resolve, reject) => {
      res.render('activeCoop/list-pdf', { groups }, (err, rendered) => {
        if (err) return reject(err);
        resolve(rendered);
      });
    });

    const puppeteer = require('puppeteer');

    // ใช้ Chromium ที่ระบบ ถ้ามี (ตั้งผ่าน ENV), ไม่งั้นใช้ตัวที่ Puppeteer ดาวน์โหลดไว้
    const executablePath = process.env.CHROMIUM_PATH || undefined;

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath,                // ถ้า undefined Puppeteer จะเลือกของตัวเอง
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="active_coop_enddate.pdf"');
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF export error:', e && e.stack || e);
    res.status(500).send('ไม่สามารถสร้าง PDF ได้');
  }
};

exports.exportEndDatePdfWk = async (req, res) => {
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

    // เตรียมฟอนต์ให้ pdfmake
    const PdfPrinter = require('pdfmake');
    const fonts = {
      THSarabun: {
        normal: path.join(__dirname, '../fonts/THSarabunNew.ttf'),
        bold: path.join(__dirname, '../fonts/THSarabunNew-Bold.ttf'),
        italics: path.join(__dirname, '../fonts/THSarabunNew-Italic.ttf'),
        bolditalics: path.join(__dirname, '../fonts/THSarabunNew-BoldItalic.ttf'),
      },
    };
    const printer = new PdfPrinter(fonts);

    // helper แปลงชื่อกลุ่ม
    const displayGroupName = (code) => {
      switch (code) {
        case 'group1': return 'กลุ่มส่งเสริมสหกรณ์ 1';
        case 'group2': return 'กลุ่มส่งเสริมสหกรณ์ 2';
        case 'group3': return 'กลุ่มส่งเสริมสหกรณ์ 3';
        case 'group4': return 'กลุ่มส่งเสริมสหกรณ์ 4';
        case 'group5': return 'กลุ่มส่งเสริมสหกรณ์ 5';
        default: return code || '-';
      }
    };

    // แยกข้อมูล สหกรณ์ / กลุ่มเกษตรกร ตามปี
    const years = Object.keys(groups || {}).sort((a, b) => b - a);
    const coopByYear = {};
    const farmerByYear = {};
    years.forEach((y) => {
      (groups[y] || []).forEach((r) => {
        if (r.coop_group === 'สหกรณ์') (coopByYear[y] ||= []).push(r);
        else if (r.coop_group === 'กลุ่มเกษตรกร') (farmerByYear[y] ||= []).push(r);
      });
    });

    const makeYearTable = (year, list) => ({
      stack: [
        { text: `ปี ${year} (ทั้งหมด ${list.length} แห่ง)`, style: 'h2', margin: [0, 12, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: [20, 60, '*', 120, 70, 70],
            body: [
              [
                { text: '#', style: 'th' },
                { text: 'รหัส', style: 'th' },
                { text: 'ชื่อ', style: 'th' },
                { text: 'กลุ่ม (c_group)', style: 'th' },
                { text: 'สถานะ', style: 'th' },
                { text: 'End Date', style: 'th' },
              ],
              ...list.map((row, idx) => ([
                { text: String(idx + 1) },
                { text: row.c_code || '-' },
                { text: row.coop_group === 'สหกรณ์' ? `${row.c_name} จำกัด` : (row.c_name || '-') },
                { text: displayGroupName(row.c_group) },
                { text: row.c_status || '-' },
                { text: row.end_date_fmt || '-' },
              ])),
            ],
          },
          layout: 'lightHorizontalLines',
          fontSize: 10,
        },
      ],
      pageBreak: 'auto',
    });

    const content = [
      { text: 'สรุปสหกรณ์ / กลุ่มเกษตรกร แยกตามปีสิ้นสุด (end_date)', style: 'title', margin: [0, 0, 0, 10] },

      { text: 'ส่วนที่ 1: สหกรณ์', style: 'h1', margin: [0, 6, 0, 0] },
      ...Object.keys(coopByYear).sort((a, b) => b - a).flatMap((y, i) => {
        const list = coopByYear[y] || [];
        if (!list.length) return [];
        return [makeYearTable(y, list)];
      }),

      { text: 'ส่วนที่ 2: กลุ่มเกษตรกร', style: 'h1', margin: [0, 16, 0, 0], pageBreak: 'before' },
      ...Object.keys(farmerByYear).sort((a, b) => b - a).flatMap((y, i) => {
        const list = farmerByYear[y] || [];
        if (!list.length) return [];
        return [makeYearTable(y, list)];
      }),
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 24],
      defaultStyle: { font: 'THSarabun', fontSize: 12 },
      styles: {
        title: { fontSize: 16, bold: true, alignment: 'center' },
        h1: { fontSize: 14, bold: true },
        h2: { fontSize: 12, bold: true },
        th: { bold: true },
      },
      content,
    };

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