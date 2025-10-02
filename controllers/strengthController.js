const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const strengthModel = require('../models/strengthModel');

// GET page
exports.showPage = async (req, res) => {
  try {
    const rows = await strengthModel.getRecent(200);
    const msg = req.query.msg || '';
    res.render('uploadStrength', { user: req.session.user, title: 'นำเข้าข้อมูลความเข้มแข็ง', rows, msg });
  } catch (e) {
    console.error(e);
    res.status(500).send('พลาดโหลดหน้า');
  }
};

// POST upload CSV
exports.importCsv = async (req, res) => {
  try {
    if (!req.file) return res.redirect('/strength?msg=ไม่พบไฟล์');
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, 'utf8');
    const records = [];
    await new Promise((resolve, reject) => {
      parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
        .on('readable', function () {
          let r; while ((r = this.read())) records.push(r);
        })
        .on('error', reject)
        .on('end', resolve);
    });
    const mapNumber = v => (v === '' || v == null ? null : Number(v));
    const prepared = records.map(r => ({
      st_code: r.st_code?.trim(),
      st_fullname: r.st_fullname?.trim(),
      st_year: parseInt(r.st_year, 10) || null,
      st_no1: mapNumber(r.st_no1),
      st_no2: mapNumber(r.st_no2),
      st_no3: mapNumber(r.st_no3),
      st_no4: mapNumber(r.st_no4),
      st_cpd: mapNumber(r.st_cpd),
      st_cad: mapNumber(r.st_cad),
      st_point: mapNumber(r.st_point),
      st_grade: r.st_grade?.trim()
    })).filter(r => r.st_code);
    if (!prepared.length) return res.redirect('/strength?msg=ไม่พบข้อมูล');
    await strengthModel.bulkUpsert(prepared);
    res.redirect('/strength?msg=นำเข้าแล้ว ' + prepared.length + ' แถว');
  } catch (e) {
    console.error('Import strength error', e);
    res.redirect('/strength?msg=พลาดนำเข้า');
  }
};
