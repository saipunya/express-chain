const pool = require('../config/db'); 
const activeCoopModel = require('../models/activeCoopModel');
const puppeteer = require('puppeteer');

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
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    // ใช้ inline เพื่อให้เปิดในแท็บ ไม่บังคับโหลด
    res.setHeader('Content-Disposition', 'inline; filename="active_coop_enddate.pdf"');
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF export error:', e);
    res.status(500).send('ไม่สามารถสร้าง PDF ได้');
  }
};