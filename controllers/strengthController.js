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
  // Fallback-safe detection list
  let detectedList = [];
  try {
    if (typeof chardet.detectAll === 'function') {
      detectedList = chardet.detectAll(buffer).slice(0, 3);
    } else {
      const single = chardet.detect(buffer) || 'UTF-8';
      detectedList = [{ name: single, confidence: 100 }];
    }
  } catch (e) {
    detectedList = [{ name: 'UTF-8', confidence: 0 }];
  }
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

// Utility: normalize keys (handle BOM on first header) and trim
function normalizeRecord(obj) {
  const out = {};
  Object.keys(obj).forEach(k => {
    let nk = k.replace(/^\uFEFF/, '').replace(/^\u00EF\u00BB\u00BF/, ''); // stray BOM
    if (nk === 'ï»¿st_code') nk = 'st_code';
    out[nk] = typeof obj[k] === 'string' ? obj[k].trim() : obj[k];
  });
  return out;
}

// Split array into chunks
function chunk(arr, size) { const r=[]; for (let i=0;i<arr.length;i+=size) r.push(arr.slice(i,i+size)); return r; }

// POST upload CSV
exports.importCsv = async (req, res) => {
  try {
    if (!req.file) return res.redirect('/strength?msg=ไม่พบไฟล์');
    const raw = fs.readFileSync(req.file.path);
    const { text: content, encoding } = decodeThai(raw);
    const records = [];
    await new Promise((resolve, reject) => {
      parse(content, { columns: true, skip_empty_lines: true, trim: true })
        .on('readable', function () { let r; while ((r = this.read())) records.push(r); })
        .on('error', reject)
        .on('end', resolve);
    });
    if (!records.length) return res.redirect('/strength?msg=ไฟล์ว่าง');
    const mapNumber = v => { if (v === '' || v == null) return 0; const num = Number(String(v).replace(/[^0-9.\-]/g,'')); return isNaN(num)?0:Number(num.toFixed(2)); };
    const prepared = records.map(r => normalizeRecord(r)).map(r => ({
      st_code: r.st_code,
      st_fullname: r.st_fullname,
      st_year: parseInt(r.st_year,10)||0,
      st_no1: mapNumber(r.st_no1),
      st_no2: mapNumber(r.st_no2),
      st_no3: mapNumber(r.st_no3),
      st_no4: mapNumber(r.st_no4),
      st_cpd: mapNumber(r.st_cpd),
      st_cad: mapNumber(r.st_cad),
      st_point: mapNumber(r.st_point),
      st_grade: r.st_grade||''
    })).filter(r => r.st_code && r.st_fullname);
    if (!prepared.length) return res.redirect('/strength?msg=หัวคอลัมน์ไม่ถูก (ตรวจ st_code...)');
    // Insert in chunks (e.g., 200 rows) to avoid packet / placeholder issues
    const batches = chunk(prepared, 200);
    for (const b of batches) {
      await strengthModel.bulkUpsert(b);
    }
    res.redirect('/strength?msg=สำเร็จ '+prepared.length+' แถว (enc='+encoding+')');
  } catch (e) {
    console.error('Import strength error', e);
    const short = encodeURIComponent(e.code || e.message.substring(0,120));
    res.redirect('/strength?msg=พลาดนำเข้า:'+short);
  }
};
