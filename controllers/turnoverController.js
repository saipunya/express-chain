const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const turnoverModel = require('../models/turnoverModel');

const normalizeText = (val) => (val == null ? '' : String(val).trim());
const normalizeCommaText = (val) => normalizeText(val).replace(/,/g, '');

const parseAmount = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const isHeaderRow = (cells = []) => {
  const joined = cells.map((c) => normalizeText(c)).join('|');
  return joined.includes('รหัสสหกรณ์') || joined.includes('ชื่อสหกรณ์') || joined.includes('ยอดเงิน');
};

const today = () => new Date().toISOString().slice(0, 10);

exports.showImportForm = async (req, res) => {
  const msg = req.query.msg || '';
  const rows = await turnoverModel.getRecent(100);
  const summary = await turnoverModel.getSummaryByMonthYear();
  res.render('turnover/import', { msg, rows, summary });
};

exports.importExcel = async (req, res) => {
  try {
    if (!req.file) return res.redirect('/turnover?msg=ไม่พบไฟล์');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.redirect('/turnover?msg=ไม่พบชีตข้อมูล');

    const records = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = normalizeCommaText(row.getCell(1).value);
      const name = normalizeCommaText(row.getCell(2).value);
      const year = normalizeCommaText(row.getCell(3).value);
      const month = normalizeCommaText(row.getCell(4).value);
      const amount = parseAmount(row.getCell(5).value);

      if (!code && !name && !year && !month && !amount) return;
      if (!code || !name || !year || !month) return;

      records.push({
        tur_code: code,
        tur_name: name,
        tur_year: year,
        tur_month: month,
        tur_amount: amount,
        tur_saveby: 'admin',
        tur_savedate: today()
      });
    });

    if (!records.length) {
      return res.redirect('/turnover?msg=ไม่พบข้อมูลที่นำเข้าได้');
    }

    const keys = records.map((r) => [r.tur_code, r.tur_year, r.tur_month]);
    const existing = await turnoverModel.getExistingKeys(keys);
    const deduped = records.filter((r) => !existing.has(`${r.tur_code}__${r.tur_year}__${r.tur_month}`));
    const skipped = records.length - deduped.length;

    if (!deduped.length) {
      return res.redirect('/turnover?msg=ข้อมูลซ้ำทั้งหมด ไม่มีรายการใหม่');
    }

    const result = await turnoverModel.bulkInsert(deduped);

    fs.unlink(req.file.path, () => {});
    const msg = `นำเข้าเรียบร้อย ${result.inserted} แถว${skipped ? ` (ข้ามซ้ำ ${skipped} แถว)` : ''}`;
    res.redirect(`/turnover?msg=${encodeURIComponent(msg)}`);
  } catch (err) {
    console.error('Turnover import error:', err);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    const message = encodeURIComponent(err.message || 'นำเข้าไม่สำเร็จ');
    res.redirect(`/turnover?msg=${message}`);
  }
};
