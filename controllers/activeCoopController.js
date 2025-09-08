const pool = require('../config/db'); 
const activeCoopModel = require('../models/activeCoopModel');
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
  await activeCoopModel.create(req.body);
  res.redirect('/activeCoop'); // จาก '/active-coop'
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