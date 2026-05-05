const fs = require('fs');
const path = require('path');
const PDFDocument = require('@foliojs-fork/pdfkit');
const { fontsDir } = require('../../config/paths');

const PAGE_MARGIN = { top: 44, right: 40, bottom: 44, left: 40 };

function resolveFontPath(fileName) {
  return path.join(fontsDir, fileName);
}

function assertFonts() {
  const required = [
    resolveFontPath('THSarabunNew.ttf'),
    resolveFontPath('THSarabunNew-Bold.ttf')
  ];
  const missing = required.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length) {
    throw new Error(`Missing Thai fonts: ${missing.join(', ')}`);
  }
}

function registerFonts(doc) {
  doc.registerFont('body', resolveFontPath('THSarabunNew.ttf'));
  doc.registerFont('bold', resolveFontPath('THSarabunNew-Bold.ttf'));
}

function thaiDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('th-TH', { dateStyle: 'medium' });
}

function thaiDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function drawText(doc, text, x, y, options = {}) {
  doc.text(String(text ?? '-'), x, y, options);
}

function drawTableHeader(doc, y, widths) {
  const headers = ['วันที่', 'เลขที่คำขอ', 'ปลายทาง', 'เวลาออก/กลับ', 'ไมล์/ระยะทาง', 'สถานะ'];
  const xPositions = [PAGE_MARGIN.left];
  for (let i = 0; i < widths.length - 1; i += 1) {
    xPositions.push(xPositions[i] + widths[i]);
  }

  doc.save();
  doc.rect(PAGE_MARGIN.left, y, widths.reduce((a, b) => a + b, 0), 22).fillAndStroke('#f3f4f6', '#d1d5db');
  doc.restore();
  doc.font('bold').fontSize(12);
  headers.forEach((header, index) => {
    drawText(doc, header, xPositions[index] + 4, y + 5, { width: widths[index] - 8, align: 'center' });
  });
}

function drawRow(doc, y, widths, row) {
  const xPositions = [PAGE_MARGIN.left];
  for (let i = 0; i < widths.length - 1; i += 1) {
    xPositions.push(xPositions[i] + widths[i]);
  }

  doc.font('body').fontSize(12);
  drawText(doc, thaiDate(row.trip_start_at), xPositions[0] + 4, y + 4, { width: widths[0] - 8 });
  drawText(doc, row.vehicle_request_no || '-', xPositions[1] + 4, y + 4, { width: widths[1] - 8 });
  drawText(doc, row.destination_text || '-', xPositions[2] + 4, y + 4, { width: widths[2] - 8 });
  drawText(doc, `${thaiDateTime(row.morning_departure_at)}\n${thaiDateTime(row.afternoon_return_at)}`, xPositions[3] + 4, y + 4, { width: widths[3] - 8, lineGap: 1 });
  drawText(doc, `${row.morning_odometer || '-'}\n${row.afternoon_odometer || '-'}\n${row.distance_km != null ? row.distance_km : '-'}`, xPositions[4] + 4, y + 4, { width: widths[4] - 8, lineGap: 1 });
  drawText(doc, row.log_status === 'completed' ? 'บันทึกครบ' : row.log_status === 'morning_logged' ? 'บันทึกเช้าแล้ว' : 'เข้าใหม่', xPositions[5] + 4, y + 4, { width: widths[5] - 8, align: 'center' });
}

async function generateDriverTripMonthlyPdf(res, payload = {}, options = {}) {
  assertFonts();

  const doc = new PDFDocument({
    size: 'A4',
    margins: PAGE_MARGIN,
    info: {
      Title: `รายงานการใช้รถยนต์ประจำเดือน ${payload.monthLabel || ''}`,
      Author: 'express-chain',
      Subject: 'Driver monthly report'
    }
  });

  registerFonts(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(options.fileName || 'driver-trip-report.pdf')}"`);
  doc.pipe(res);

  const fullWidth = doc.page.width - PAGE_MARGIN.left - PAGE_MARGIN.right;
  const widths = [
    Math.round(fullWidth * 0.11),
    Math.round(fullWidth * 0.16),
    Math.round(fullWidth * 0.20),
    Math.round(fullWidth * 0.19),
    Math.round(fullWidth * 0.16),
    fullWidth - Math.round(fullWidth * 0.11) - Math.round(fullWidth * 0.16) - Math.round(fullWidth * 0.20) - Math.round(fullWidth * 0.19) - Math.round(fullWidth * 0.16)
  ];

  let y = PAGE_MARGIN.top;
  doc.font('bold').fontSize(18).text('รายงานการใช้รถยนต์รายเดือน', PAGE_MARGIN.left, y, { width: fullWidth, align: 'center' });
  y += 22;
  doc.font('body').fontSize(14).text(`เดือน: ${payload.monthLabel || '-'}`, PAGE_MARGIN.left, y, { width: fullWidth, align: 'center' });
  y += 18;
  doc.font('body').fontSize(14).text(`คนขับ: ${payload.driver?.driver_name || '-'}`, PAGE_MARGIN.left, y, { width: fullWidth, align: 'center' });
  y += 22;

  const summaryText = [
    `จำนวนงานทั้งหมด ${payload.summary?.total || 0} งาน`,
    `บันทึกเช้าแล้ว ${payload.summary?.morningLogged || 0} งาน`,
    `เสร็จสิ้นแล้ว ${payload.summary?.completed || 0} งาน`,
    `ระยะทางรวม ${Number(payload.summary?.distance || 0).toFixed(1)} กม.`
  ].join('   |   ');
  doc.font('body').fontSize(13).text(summaryText, PAGE_MARGIN.left, y, { width: fullWidth, align: 'center' });
  y += 24;

  doc.font('bold').fontSize(12);
  drawTableHeader(doc, y, widths);
  y += 22;

  const rowBaseHeight = 38;
  const rowExtraHeight = 14;
  (payload.items || []).forEach((row) => {
    const rowHeight = rowBaseHeight
      + (row.morning_departure_at ? 12 : 0)
      + (row.afternoon_return_at ? 12 : 0)
      + (row.distance_km != null ? 12 : 0);
    if (y + rowHeight > doc.page.height - PAGE_MARGIN.bottom) {
      doc.addPage();
      y = PAGE_MARGIN.top;
      drawTableHeader(doc, y, widths);
      y += 22;
    }

    doc.rect(PAGE_MARGIN.left, y, widths.reduce((a, b) => a + b, 0), rowHeight).stroke('#cbd5e1');
    drawRow(doc, y, widths, row);
    y += rowHeight;
  });

  if (!(payload.items || []).length) {
    doc.font('body').fontSize(14).text('ไม่พบรายการในเดือนที่เลือก', PAGE_MARGIN.left, y + 16, { width: fullWidth, align: 'center' });
  }

  doc.end();
  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });
}

module.exports = generateDriverTripMonthlyPdf;
