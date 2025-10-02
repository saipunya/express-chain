const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const strengthModel = require('../models/strengthModel');
const chardet = require('chardet');
const iconv = require('iconv-lite');

// Helper: robust Thai decode
function decodeThai(buffer) {
  // UTF-8 BOM check
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { text: buffer.toString('utf8'), encoding: 'UTF-8-BOM' };
  }
  const detectedList = chardet.detectAll(buffer).slice(0, 3);
  const primary = (detectedList[0] && detectedList[0].name) || 'UTF-8';
  // Try UTF-8 first
  let utf8Text = buffer.toString('utf8');
  const hasReplacement = utf8Text.includes('\uFFFD');
  const hasThai = /[ก-๛]/.test(utf8Text);
  // If UTF-8 text appears fine and has Thai, keep it
  if (!hasReplacement && hasThai) {
    return { text: utf8Text, encoding: 'UTF-8' };
  }
  // Candidate legacy encodings to try
  const legacyCandidates = ['TIS-620', 'ISO-8859-11', 'windows-874'];
  let tried = [];
  for (const cand of legacyCandidates) {
    try {
      const t = iconv.decode(buffer, cand);
      if (/[ก-๛]/.test(t)) {
        if (process.env.STRENGTH_LOG_ENCODING) console.log('[strength] decoded as', cand, 'detected', primary, 'list', detectedList);
        return { text: t, encoding: cand };
      }
      tried.push(cand);
    } catch (e) { /* ignore */ }
  }
  // Fallback: if primary suggests a legacy encoding use it
  if (/tis|iso-8859-11|874/i.test(primary)) {
    try {
      const t = iconv.decode(buffer, 'TIS-620');
      return { text: t, encoding: 'TIS-620' };
    } catch (e) { /* ignore */ }
  }
  // Last resort return utf8Text
  if (process.env.STRENGTH_LOG_ENCODING) console.log('[strength] fallback utf8 primary=', primary, 'tried=', tried);
  return { text: utf8Text, encoding: primary };
}

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
    const raw = fs.readFileSync(req.file.path);
    const { text: content, encoding } = decodeThai(raw);
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
    const mapNumber = v => (v === '' || v == null ? 0 : Number(parseFloat(v).toFixed(2)));
    const prepared = records.map(r => ({
      st_code: r.st_code?.trim(),
      st_fullname: r.st_fullname?.trim(),
      st_year: parseInt(r.st_year, 10) || 0,
      st_no1: mapNumber(r.st_no1),
      st_no2: mapNumber(r.st_no2),
      st_no3: mapNumber(r.st_no3),
      st_no4: mapNumber(r.st_no4),
      st_cpd: mapNumber(r.st_cpd),
      st_cad: mapNumber(r.st_cad),
      st_point: mapNumber(r.st_point),
      st_grade: r.st_grade?.trim() || ''
    })).filter(r => r.st_code && r.st_fullname);
    if (!prepared.length) return res.redirect('/strength?msg=ไม่พบข้อมูล');
    await strengthModel.bulkUpsert(prepared);
    res.redirect('/strength?msg=นำเข้าแล้ว ' + prepared.length + ' แถว (enc=' + encoding + ')');
  } catch (e) {
    console.error('Import strength error', e);
    res.redirect('/strength?msg=พลาดนำเข้า');
  }
};
