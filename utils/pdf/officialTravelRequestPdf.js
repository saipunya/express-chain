const fs = require('fs');
const path = require('path');
const PDFDocument = require('@foliojs-fork/pdfkit');
const thaiDate = require('../thaiDate');
const { fontsDir } = require('../../config/paths');

const PAGE_MARGIN = {
  top: 48,
  right: 54,
  bottom: 48,
  left: 54
};

const FONT_FAMILY = {
  regular: 'THSarabunNew',
  bold: 'THSarabunNew-Bold'
};

const FONT_SIZE = {
  title: 20,
  section: 16,
  body: 15,
  small: 14
};

const DEFAULTS = {
  documentTitle: 'บันทึกข้อความ',
  subject: 'ขออนุมัติเดินทางไปราชการ',
  learnTo: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
  closingText: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
  opinionText: '-',
  approvalStatus: 'pending'
};

/*
Example formData
{
  departmentName: 'สำนักงานสหกรณ์จังหวัดชัยภูมิ กลุ่มส่งเสริมสหกรณ์ 1',
  phone: '0 4400 0000',
  bookNo: 'ชย 0010/2569',
  date: '2026-04-16',
  subject: 'ขออนุมัติเดินทางไปราชการ',
  learnTo: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
  requesterName: 'นายสมชาย ใจดี',
  requesterPosition: 'นักวิชาการสหกรณ์ชำนาญการ',
  requesterDepartment: 'กลุ่มส่งเสริมสหกรณ์ 1',
  companions: [
    { name: 'นางสาวสุดา พัฒนา', position: 'นักวิชาการสหกรณ์ปฏิบัติการ' },
    { name: 'นายอนุชา ทำงาน', position: 'เจ้าพนักงานธุรการ' }
  ],
  purpose: 'เข้าร่วมประชุมติดตามผลการดำเนินงานและลงพื้นที่ตรวจเยี่ยมสหกรณ์',
  destination: 'สหกรณ์การเกษตรภูเขียว จำกัด อำเภอภูเขียว จังหวัดชัยภูมิ',
  startDate: '2026-04-20',
  endDate: '2026-04-20',
  durationDays: 1,
  transportDetails: 'รถยนต์ราชการ ทะเบียน กข 1234 ชัยภูมิ',
  closingText: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
  signerName: 'นายสมชาย ใจดี',
  signerPosition: 'นักวิชาการสหกรณ์ชำนาญการ',
  opinionText: 'เห็นควรอนุมัติ เนื่องจากเป็นภารกิจตามแผนงานประจำปี',
  approverName: 'นายตัวอย่าง ผู้อนุมัติ',
  approverPosition: 'สหกรณ์จังหวัดชัยภูมิ',
  approvalStatus: 'approved',
  approvalDate: '2026-04-17'
}
*/

function resolveFontPath(fileName) {
  return path.join(fontsDir, fileName);
}

function assertThaiFonts() {
  const requiredFonts = [
    resolveFontPath('THSarabunNew.ttf'),
    resolveFontPath('THSarabunNew-Bold.ttf')
  ];

  const missingFonts = requiredFonts.filter((fontPath) => !fs.existsSync(fontPath));
  if (missingFonts.length) {
    throw new Error(
      `Missing Thai fonts: ${missingFonts.join(', ')}. ` +
      'Please place THSarabunNew.ttf and THSarabunNew-Bold.ttf in the fonts directory.'
    );
  }
}

function registerFonts(doc) {
  doc.registerFont(FONT_FAMILY.regular, resolveFontPath('THSarabunNew.ttf'));
  doc.registerFont(FONT_FAMILY.bold, resolveFontPath('THSarabunNew-Bold.ttf'));
}

function sanitizeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  return thaiDate(value);
}

function getDurationDays(formData) {
  const numericDays = Number(formData.durationDays);
  if (numericDays > 0) {
    return numericDays;
  }

  const start = new Date(formData.startDate);
  const end = new Date(formData.endDate || formData.startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const oneDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / oneDay) + 1;
  return Math.max(1, diff);
}

function normalizeCompanions(companions) {
  const rows = safeArray(companions)
    .slice(0, 7)
    .map((companion) => ({
      name: sanitizeText(companion?.name || companion?.companion_name, ''),
      position: sanitizeText(companion?.position || companion?.companion_position, '')
    }))
    .filter((companion) => companion.name || companion.position);

  while (rows.length < 1) {
    rows.push({ name: '', position: '' });
  }

  return rows;
}

function normalizeFormData(formData = {}) {
  return {
    ...DEFAULTS,
    ...formData,
    departmentName: sanitizeText(formData.departmentName),
    phone: sanitizeText(formData.phone),
    bookNo: sanitizeText(formData.bookNo),
    date: formData.date || new Date(),
    subject: sanitizeText(formData.subject || DEFAULTS.subject),
    learnTo: sanitizeText(formData.learnTo || DEFAULTS.learnTo),
    requesterName: sanitizeText(formData.requesterName),
    requesterPosition: sanitizeText(formData.requesterPosition),
    requesterDepartment: sanitizeText(formData.requesterDepartment),
    purpose: sanitizeText(formData.purpose),
    destination: sanitizeText(formData.destination),
    startDate: formData.startDate || formData.date || new Date(),
    endDate: formData.endDate || formData.startDate || formData.date || new Date(),
    durationDays: getDurationDays(formData),
    transportDetails: sanitizeText(formData.transportDetails),
    closingText: sanitizeText(formData.closingText || DEFAULTS.closingText),
    signerName: sanitizeText(formData.signerName || formData.requesterName),
    signerPosition: sanitizeText(formData.signerPosition || formData.requesterPosition),
    opinionText: sanitizeText(formData.opinionText || DEFAULTS.opinionText),
    approverName: sanitizeText(formData.approverName, ''),
    approverPosition: sanitizeText(formData.approverPosition, ''),
    approvalStatus: ['approved', 'rejected', 'pending'].includes(formData.approvalStatus)
      ? formData.approvalStatus
      : DEFAULTS.approvalStatus,
    approvalDate: formData.approvalDate || null,
    companions: normalizeCompanions(formData.companions)
  };
}

function createLayoutState(doc) {
  return {
    margin: PAGE_MARGIN,
    contentWidth: doc.page.width - PAGE_MARGIN.left - PAGE_MARGIN.right,
    cursorY: PAGE_MARGIN.top
  };
}

function setBodyFont(doc, isBold = false, size = FONT_SIZE.body) {
  doc.font(isBold ? FONT_FAMILY.bold : FONT_FAMILY.regular).fontSize(size);
}

function ensurePageSpace(doc, state, minimumHeight) {
  const bottomLimit = doc.page.height - PAGE_MARGIN.bottom;
  if (state.cursorY + minimumHeight <= bottomLimit) {
    return;
  }

  doc.addPage();
  state.cursorY = PAGE_MARGIN.top;
  state.contentWidth = doc.page.width - PAGE_MARGIN.left - PAGE_MARGIN.right;
  setBodyFont(doc, false, FONT_SIZE.body);
}

function drawDottedRule(doc, x1, x2, y) {
  doc
    .save()
    .lineWidth(0.7)
    .dash(1, { space: 2 })
    .moveTo(x1, y)
    .lineTo(x2, y)
    .stroke('#666666')
    .undash()
    .restore();
}

function drawFieldRow(doc, state, options) {
  const {
    label,
    value,
    labelWidth = 72,
    minHeight = 24
  } = options;

  const x = PAGE_MARGIN.left;
  const valueWidth = state.contentWidth - labelWidth;

  setBodyFont(doc, true);
  const valueText = sanitizeText(value);
  setBodyFont(doc);
  const valueHeight = doc.heightOfString(valueText, {
    width: valueWidth - 8,
    lineGap: 2
  });
  const rowHeight = Math.max(minHeight, valueHeight + 6);

  ensurePageSpace(doc, state, rowHeight + 4);
  const y = state.cursorY;
  const baselineY = y + rowHeight - 4;

  setBodyFont(doc, true);
  doc.text(label, x, y, { width: labelWidth, lineGap: 2 });

  drawDottedRule(doc, x + labelWidth, x + state.contentWidth, baselineY);
  setBodyFont(doc);
  doc.text(valueText, x + labelWidth + 4, y, {
    width: valueWidth - 8,
    lineGap: 2
  });

  state.cursorY += rowHeight + 2;
}

function drawIndentedParagraph(doc, state, label, text) {
  const x = PAGE_MARGIN.left;
  const width = state.contentWidth;
  const indent = 34;
  const labelText = sanitizeText(label, '');
  const contentText = sanitizeText(text);
  const labelWidth = 72;

  const paragraphHeight = doc.heightOfString(contentText, {
    width: width - indent - labelWidth,
    lineGap: 3
  });

  ensurePageSpace(doc, state, paragraphHeight + 18);

  setBodyFont(doc, true);
  doc.text(labelText, x, state.cursorY, { width: labelWidth, lineGap: 4 });

  setBodyFont(doc);
  doc.text(contentText, x + labelWidth, state.cursorY, {
    width: width - labelWidth,
    align: 'justify',
    lineGap: 3,
    indent
  });

  state.cursorY += paragraphHeight + 10;
}

function drawSectionTitle(doc, state, title) {
  ensurePageSpace(doc, state, 22);
  setBodyFont(doc, true, FONT_SIZE.section);
  doc.text(title, PAGE_MARGIN.left, state.cursorY, { width: state.contentWidth });
  state.cursorY += 18;
}

function drawCompanionRows(doc, state, companions) {
  drawSectionTitle(doc, state, 'ผู้ร่วมเดินทาง');

  companions.forEach((companion, index) => {
    ensurePageSpace(doc, state, 22);

    const x = PAGE_MARGIN.left;
    const y = state.cursorY;
    const numberWidth = 24;
    const nameLabelWidth = 34;
    const positionLabelWidth = 52;
    const gap = 8;
    const contentWidth = state.contentWidth - numberWidth;
    const nameWidth = Math.floor(contentWidth * 0.54);
    const positionWidth = contentWidth - nameWidth - nameLabelWidth - positionLabelWidth - gap;

    setBodyFont(doc, false);
    doc.text(`${index + 1}.`, x, y, { width: numberWidth });

    setBodyFont(doc, true);
    doc.text('ชื่อ', x + numberWidth, y, { width: nameLabelWidth });
    drawDottedRule(doc, x + numberWidth + nameLabelWidth, x + numberWidth + nameLabelWidth + nameWidth, y + 18);

    setBodyFont(doc, false);
    doc.text(companion.name || ' ', x + numberWidth + nameLabelWidth + 4, y, {
      width: nameWidth - 8
    });

    const positionX = x + numberWidth + nameLabelWidth + nameWidth + gap;
    setBodyFont(doc, true);
    doc.text('ตำแหน่ง', positionX, y, { width: positionLabelWidth });
    drawDottedRule(doc, positionX + positionLabelWidth, x + state.contentWidth, y + 18);

    setBodyFont(doc, false);
    doc.text(companion.position || ' ', positionX + positionLabelWidth + 4, y, {
      width: positionWidth - 8
    });

    state.cursorY += 22;
  });

  state.cursorY += 4;
}

function drawPeriodAndTransport(doc, state, formData) {
  drawSectionTitle(doc, state, 'กำหนดการเดินทาง');

  drawFieldRow(doc, state, {
    label: 'สถานที่',
    value: formData.destination,
    labelWidth: 62,
    minHeight: 26
  });

  drawFieldRow(doc, state, {
    label: 'ระหว่างวันที่',
    value: `${formatDate(formData.startDate)} ถึง ${formatDate(formData.endDate)} รวม ${formData.durationDays} วัน`,
    labelWidth: 84,
    minHeight: 26
  });

  drawFieldRow(doc, state, {
    label: 'พาหนะ',
    value: formData.transportDetails,
    labelWidth: 62,
    minHeight: 26
  });

  state.cursorY += 2;
}

function renderHeader(doc, formData, state) {
  setBodyFont(doc, true, FONT_SIZE.title);
  doc.text(formData.documentTitle, PAGE_MARGIN.left, state.cursorY, {
    width: state.contentWidth,
    align: 'center'
  });
  state.cursorY += 28;

  drawFieldRow(doc, state, {
    label: 'ส่วนราชการ',
    value: formData.departmentName,
    labelWidth: 76,
    minHeight: 26
  });

  const lineStartY = state.cursorY;
  const columnGap = 16;
  const leftWidth = Math.floor((state.contentWidth - columnGap) * 0.62);
  const rightWidth = state.contentWidth - leftWidth - columnGap;

  const x = PAGE_MARGIN.left;

  setBodyFont(doc, true);
  doc.text('ที่', x, lineStartY, { width: 24 });
  drawDottedRule(doc, x + 20, x + leftWidth, lineStartY + 18);
  setBodyFont(doc, false);
  doc.text(formData.bookNo, x + 26, lineStartY, { width: leftWidth - 32 });

  const rightX = x + leftWidth + columnGap;
  setBodyFont(doc, true);
  doc.text('โทรศัพท์', rightX, lineStartY, { width: 54 });
  drawDottedRule(doc, rightX + 54, x + state.contentWidth, lineStartY + 18);
  setBodyFont(doc, false);
  doc.text(formData.phone, rightX + 58, lineStartY, { width: rightWidth - 8 });
  state.cursorY += 24;

  drawFieldRow(doc, state, {
    label: 'วันที่',
    value: formatDate(formData.date),
    labelWidth: 52,
    minHeight: 24
  });

  drawFieldRow(doc, state, {
    label: 'เรื่อง',
    value: formData.subject,
    labelWidth: 52,
    minHeight: 24
  });

  drawFieldRow(doc, state, {
    label: 'เรียน',
    value: formData.learnTo,
    labelWidth: 52,
    minHeight: 24
  });

  state.cursorY += 4;
}

function renderBody(doc, formData, state) {
  drawIndentedParagraph(
    doc,
    state,
    'ข้าพเจ้า',
    `${formData.requesterName} ตำแหน่ง ${formData.requesterPosition} สังกัด ${formData.requesterDepartment}`
  );

  drawCompanionRows(doc, state, formData.companions);
  drawIndentedParagraph(doc, state, 'วัตถุประสงค์', formData.purpose);
  drawPeriodAndTransport(doc, state, formData);
  drawIndentedParagraph(doc, state, 'ลงท้าย', formData.closingText);
}

function renderSignature(doc, formData, state) {
  ensurePageSpace(doc, state, 110);

  const blockWidth = 210;
  const x = PAGE_MARGIN.left + state.contentWidth - blockWidth;
  const y = state.cursorY + 6;

  setBodyFont(doc, false);
  doc.text('ลงชื่อ', x, y, { width: 38 });
  drawDottedRule(doc, x + 34, x + blockWidth, y + 18);

  doc.text(`(${formData.signerName})`, x, y + 30, {
    width: blockWidth,
    align: 'center'
  });

  doc.text(formData.signerPosition, x, y + 54, {
    width: blockWidth,
    align: 'center'
  });

  state.cursorY = y + 74;
}

function drawChoiceCircle(doc, x, y, label, selected) {
  doc.circle(x, y + 8, 6).lineWidth(1).stroke('#222222');

  if (selected) {
    doc.circle(x, y + 8, 3).fill('#222222');
  }

  setBodyFont(doc, false);
  doc.text(label, x + 14, y, { width: 70 });
}

function renderApprovalSection(doc, formData, state) {
  const x = PAGE_MARGIN.left;
  const boxWidth = state.contentWidth;
  const opinionWidth = boxWidth - 74;

  setBodyFont(doc, false);
  const opinionHeight = Math.max(36, doc.heightOfString(formData.opinionText, {
    width: opinionWidth,
    lineGap: 3
  }));

  const boxHeight = Math.max(166, opinionHeight + 120);
  ensurePageSpace(doc, state, boxHeight + 16);

  const y = state.cursorY + 8;

  doc.rect(x, y, boxWidth, boxHeight).lineWidth(1).stroke('#444444');

  setBodyFont(doc, true);
  doc.text('ความเห็น / ผลการพิจารณา', x + 10, y + 8, { width: boxWidth - 20 });

  setBodyFont(doc, true);
  doc.text('ความเห็น', x + 10, y + 32, { width: 54 });
  setBodyFont(doc, false);
  doc.text(formData.opinionText, x + 64, y + 32, {
    width: opinionWidth,
    lineGap: 3
  });

  const dividerY = y + 40 + opinionHeight;
  drawDottedRule(doc, x + 10, x + boxWidth - 10, dividerY);

  setBodyFont(doc, true);
  doc.text('ผลอนุมัติ', x + 10, dividerY + 10, { width: 54 });

  drawChoiceCircle(doc, x + 74, dividerY + 8, 'อนุมัติ', formData.approvalStatus === 'approved');
  drawChoiceCircle(doc, x + 150, dividerY + 8, 'ไม่อนุมัติ', formData.approvalStatus === 'rejected');
  drawChoiceCircle(doc, x + 244, dividerY + 8, 'รอพิจารณา', formData.approvalStatus === 'pending');

  setBodyFont(doc, false);
  doc.text('ลงชื่อ', x + boxWidth - 220, dividerY + 24, { width: 34 });
  drawDottedRule(doc, x + boxWidth - 184, x + boxWidth - 12, dividerY + 42);

  doc.text(`(${formData.approverName || ' '})`, x + boxWidth - 220, dividerY + 52, {
    width: 208,
    align: 'center'
  });
  doc.text(formData.approverPosition || ' ', x + boxWidth - 220, dividerY + 74, {
    width: 208,
    align: 'center'
  });

  setBodyFont(doc, false);
  doc.text(
    `วันที่ ${formData.approvalDate ? formatDate(formData.approvalDate) : '........................................'}`,
    x + 10,
    dividerY + 44,
    { width: 220 }
  );

  state.cursorY = y + boxHeight;
}

async function generateOfficialTravelRequestPdf(res, formData = {}, options = {}) {
  assertThaiFonts();

  const normalized = normalizeFormData(formData);
  const fileName = options.fileName || `travel-request-${Date.now()}.pdf`;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: PAGE_MARGIN,
    info: {
      Title: normalized.subject,
      Author: 'express-chain',
      Subject: normalized.documentTitle,
      Keywords: 'travel request, official memo, pdfkit, thai'
    }
  });

  registerFonts(doc);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);

  doc.pipe(res);

  const state = createLayoutState(doc);
  setBodyFont(doc);

  renderHeader(doc, normalized, state);
  renderBody(doc, normalized, state);
  renderSignature(doc, normalized, state);
  renderApprovalSection(doc, normalized, state);

  doc.end();

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });
}

module.exports = {
  generateOfficialTravelRequestPdf,
  normalizeFormData,
  renderHeader,
  renderBody,
  renderSignature,
  renderApprovalSection
};
