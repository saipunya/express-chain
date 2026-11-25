const ExcelJS = require('exceljs');
const yauzl = require('yauzl');
const { validSignature } = require('./uploadSecurity');
const { MAX_ITEMS, isValidQuestion } = require('../utils/learningQuestions');

const CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_UPLOAD = 1024 * 1024;
const HEADERS = ['คำถาม', 'ตัวเลือก 1', 'ตัวเลือก 2', 'ตัวเลือก 3', 'คำตอบที่ถูกต้อง'];

class QuizImportError extends Error {}

function checkWorkbookArchive(bytes) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, archive) => {
      if (error) return reject(error);
      function fail(reason) {
        archive.close();
        reject(reason);
      }
      let expandedSize = 0;
      archive.once('error', fail);
      archive.once('end', resolve);
      archive.on('entry', (entry) => {
        expandedSize += entry.uncompressedSize;
        if (expandedSize > 8 * MAX_UPLOAD) return fail(new Error('Workbook expands beyond size limit'));
        if (entry.fileName.endsWith('/')) return archive.readEntry();
        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail(streamError);
          stream.once('error', fail);
          stream.once('end', () => archive.readEntry());
          stream.resume();
        });
      });
      if (archive.entryCount > 256) return fail(new Error('Workbook contains too many entries'));
      archive.readEntry();
    });
  });
}

function cellText(cell) {
  switch (cell.type) {
    case ExcelJS.ValueType.Null: return '';
    case ExcelJS.ValueType.String:
    case ExcelJS.ValueType.Number:
    case ExcelJS.ValueType.RichText:
    case ExcelJS.ValueType.Hyperlink: return cell.text.trim();
    default: throw new QuizImportError(`ช่อง ${cell.address} กรุณาใช้ข้อความหรือตัวเลข`);
  }
}

async function readQuestions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_UPLOAD || !validSignature('.xlsx', bytes)) {
    throw new QuizImportError('กรุณาเลือกไฟล์ Excel .xlsx ขนาดไม่เกิน 1 MB');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await checkWorkbookArchive(bytes);
    await workbook.xlsx.load(bytes);
  } catch {
    throw new QuizImportError('อ่านไฟล์ Excel ไม่ได้ กรุณาบันทึกไฟล์ใหม่เป็น .xlsx หรือลองใช้แม่แบบ');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || !HEADERS.every((header, index) => sheet.getRow(1).getCell(index + 1).text.trim() === header)) {
    throw new QuizImportError('หัวคอลัมน์ในชีตแรกยังไม่ตรงกับแม่แบบ กรุณาคงแถวแรกตามแม่แบบ');
  }
  const questions = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const [prompt, first, second, third, answer] = HEADERS.map((_, index) => cellText(row.getCell(index + 1)));
    if (!(prompt || first || second || third || answer)) return;
    const correct = /^[1-3]$/.test(answer) ? String(Number(answer) - 1) : '';
    const question = { prompt, choices: [first, second, third], correct };
    if (!isValidQuestion(question)) {
      throw new QuizImportError(`แถว ${rowNumber} กรุณาตรวจคำถาม (ไม่เกิน 350 ตัวอักษร) ตัวเลือก 3 ข้อที่ต่างกัน (ข้อละไม่เกิน 250 ตัวอักษร) และคำตอบที่ถูกต้องเป็นเลข 1, 2 หรือ 3`);
    }
    if (questions.length >= MAX_ITEMS) throw new QuizImportError(`นำเข้าได้สูงสุด ${MAX_ITEMS} ข้อต่อแบบทดสอบ`);
    questions.push(question);
  });
  if (!questions.length) throw new QuizImportError('เพิ่มคำถามอย่างน้อย 1 ข้อในชีตแรกก่อนนำเข้า');
  return questions;
}

module.exports = { CONTENT_TYPE, MAX_UPLOAD, HEADERS, readQuestions, QuizImportError };
