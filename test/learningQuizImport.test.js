const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { HEADERS, readQuestions, QuizImportError } = require('../services/learningQuizImport');
const { MAX_ITEMS } = require('../utils/learningQuestions');

const valid = ['สหกรณ์มีสมาชิกกี่คนในตัวอย่าง', 10, '20', '30', 2];

async function workbookBuffer(rows, headers = HEADERS) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('แบบทดสอบ');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return workbook.xlsx.writeBuffer();
}

test('the downloadable Excel template round-trips Thai questions and one-based answer columns', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(__dirname, '../templates/learning/quiz-import.xlsx'));
  const sheet = workbook.worksheets[0];
  assert.deepEqual(sheet.getRow(1).values.slice(1), HEADERS);
  assert.deepEqual(sheet.getCell('E2').dataValidation.formulae, ['"1,2,3"']);
  sheet.getRow(2).values = valid;
  sheet.getRow(4).values = ['  คำถามถัดไป  ', 'หนึ่ง', 'สอง', 'สาม', '3'];
  assert.deepEqual(await readQuestions(await workbook.xlsx.writeBuffer()), [
    { prompt: valid[0], choices: ['10', '20', '30'], correct: '1' },
    { prompt: 'คำถามถัดไป', choices: ['หนึ่ง', 'สอง', 'สาม'], correct: '2' }
  ]);
});

test('Excel quiz import reports the offending row and rejects the whole batch', async () => {
  const wrongAnswer = [...valid.slice(0, 4), 4];
  const duplicateChoice = ['คำถาม', ' ก ', 'ก', 'ค', 1];
  const formulaAnswer = [...valid.slice(0, 4), { formula: '1+1', result: 2 }];
  await assert.rejects(readQuestions(await workbookBuffer([valid, [], wrongAnswer])), /แถว 4/);
  await assert.rejects(readQuestions(await workbookBuffer([duplicateChoice])), /แถว 2/);
  await assert.rejects(readQuestions(await workbookBuffer([formulaAnswer])), /E2/);
});

test('Excel quiz import rejects the wrong workbook layout, blank data, and more than the quiz limit', async () => {
  await assert.rejects(readQuestions(await workbookBuffer([valid], HEADERS.toReversed())), /หัวคอลัมน์/);
  await assert.rejects(readQuestions(await workbookBuffer([[]])), /อย่างน้อย 1 ข้อ/);
  await assert.rejects(readQuestions(await workbookBuffer(Array.from({ length: MAX_ITEMS + 1 }, () => valid))), /สูงสุด 20 ข้อ/);
  await assert.rejects(readQuestions(Buffer.from('not a workbook')), QuizImportError);
  await assert.rejects(readQuestions(Buffer.from('504b0304', 'hex')), /อ่านไฟล์ Excel ไม่ได้/);
});
