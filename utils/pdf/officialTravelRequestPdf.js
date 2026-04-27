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
  opinionText: '',
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

function sanitizeTime(value) {
  return String(value ?? '').trim();
}

function formatTime(value) {
  const raw = sanitizeTime(value);
  if (!raw) {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    const hours = String(Number(hhmmMatch[1])).padStart(2, '0');
    return `${hours}:${hhmmMatch[2]}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const embeddedMatch = raw.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (embeddedMatch) {
    return `${embeddedMatch[1]}:${embeddedMatch[2]}`;
  }

  return raw;
}

function formatTimeRange(startTime, endTime) {
  const start = formatTime(startTime);
  const end = formatTime(endTime);

  if (start && end) {
    return `${start} ถึง ${end} น.`;
  }
  if (start) {
    return `${start} น.`;
  }
  if (end) {
    return `${end} น.`;
  }

  return '-';
}
// FIX START: Removed Thai word-break helper to avoid inserting invisible characters
// Helper `insertThaiWordBreaks` removed per request — render original Thai text directly.
// FIX END

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
    startTime: sanitizeTime(formData.startTime || formData.start_time),
    endTime: sanitizeTime(formData.endTime || formData.end_time),
    durationDays: getDurationDays(formData),
    transportDetails: sanitizeText(formData.transportDetails),
    closingText: sanitizeText(formData.closingText || DEFAULTS.closingText),
    signerName: sanitizeText(formData.signerName || formData.requesterName),
    signerPosition: sanitizeText(formData.signerPosition || formData.requesterPosition),
    opinionText: formData.opinionText != null
      ? sanitizeText(formData.opinionText, '')
      : DEFAULTS.opinionText,
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
  // FIX START: Use left alignment and tighter line/paragraph gaps for Thai text
  const x = PAGE_MARGIN.left;
  const width = state.contentWidth;
  const labelText = sanitizeText(label, '');
  const hasLabel = Boolean(labelText);
  const labelWidth = 72;
  const indent = 34;
  const contentText = sanitizeText(text);
  const lineGap = 2; // within recommended 2-4
  const paragraphGap = 8; // within recommended 6-10

  const paragraphHeight = doc.heightOfString(contentText, {
    width: width - labelWidth - 4,
    lineGap
  });

  ensurePageSpace(doc, state, paragraphHeight + paragraphGap + 6);

  if (hasLabel) {
    setBodyFont(doc, true);
    doc.text(labelText, x, state.cursorY, { width: labelWidth, lineGap: 3 });
  }

  setBodyFont(doc);
  doc.text(contentText, x + labelWidth, state.cursorY, {
    width: width - labelWidth - 4,
    align: 'left',
    lineGap,
    indent
  });

  state.cursorY += paragraphHeight + paragraphGap;
  // FIX END
}

function drawFullParagraph(doc, state, text, options = {}) {
  // FIX START: Force left alignment, constrain lineGap, add paragraphGap and slightly reduce width for better Thai wrapping
  const left = typeof options.left === 'number' ? options.left : PAGE_MARGIN.left;
  const indent = options.indent ?? 0;
  const width = state.contentWidth - (left - PAGE_MARGIN.left) - 4;
  const contentText = sanitizeText(text, '');
  let lineGap = options.lineGap ?? 2;
  lineGap = Math.max(2, Math.min(lineGap, 4));
  const paragraphGap = options.paragraphGap ?? 8;
  const align = 'left';

  if (!contentText) {
    return;
  }

  const paragraphHeight = doc.heightOfString(contentText, {
    width,
    lineGap,
    indent
  });

  ensurePageSpace(doc, state, paragraphHeight + paragraphGap + 6);

  setBodyFont(doc, false);
  doc.text(contentText, left, state.cursorY, {
    width,
    lineGap,
    align,
    indent
  });

  state.cursorY += paragraphHeight + paragraphGap;
  // FIX END
}

function drawSectionTitle(doc, state, title) {
  ensurePageSpace(doc, state, 22);
  setBodyFont(doc, true, FONT_SIZE.section);
  doc.text(title, PAGE_MARGIN.left, state.cursorY, { width: state.contentWidth });
  state.cursorY += 18;
}

function drawCompanionRows(doc, state, companions) {
  drawSectionTitle(doc, state, 'พร้อมด้วย');

  companions.forEach((companion) => {
    ensurePageSpace(doc, state, 22);

    const x = PAGE_MARGIN.left;
    const y = state.cursorY;
    const nameLabelWidth = 34;
    const positionLabelWidth = 52;
    const gap = 8;
    const contentWidth = state.contentWidth;
    const nameWidth = Math.floor((contentWidth - nameLabelWidth - positionLabelWidth - gap) * 0.54);
    const positionWidth = contentWidth - nameWidth - nameLabelWidth - positionLabelWidth - gap;

    setBodyFont(doc, true);
    doc.text('ชื่อ', x, y, { width: nameLabelWidth });
    drawDottedRule(doc, x + nameLabelWidth, x + nameLabelWidth + nameWidth, y + 18);

    setBodyFont(doc, false);
    doc.text(companion.name || ' ', x + nameLabelWidth + 4, y, {
      width: nameWidth - 8
    });

    const positionX = x + nameLabelWidth + nameWidth + gap;
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
  drawSectionTitle(doc, state, '');

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

  // เพิ่มแถว 'เวลา' เพื่อแสดงช่วงเวลาที่ขอไปราชการ
  const timeValue = formatTimeRange(formData.startTime, formData.endTime);

  drawFieldRow(doc, state, {
    label: 'เวลา',
    value: timeValue,
    labelWidth: 62,
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
  doc.text('วันที่', rightX, lineStartY, { width: 54 });
  drawDottedRule(doc, rightX + 54, x + state.contentWidth, lineStartY + 18);
  setBodyFont(doc, false);
  doc.text(formatDate(formData.date), rightX + 58, lineStartY, { width: rightWidth - 8 });
  state.cursorY += 24;

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
  // renderBody: intro/middle/closing handling follows below
  // FIX START: Split body into three blocks (intro, middle, closing).
  // - Intro: fixed at the 'เรียน' value column (preserve original Y)
  // - Middle: expanded width to use more horizontal space, first-line indented
  // - Closing: fixed at the original closing Y position so signature/approval not moved

  const labelWidthForLearn = 52; // matches header 'เรียน' labelWidth
  const valueLeftX = PAGE_MARGIN.left + labelWidthForLearn + 4;



  // Build parts
const requesterPart = `ข้าพเจ้า ${sanitizeText(formData.requesterName, '')} ตำแหน่ง ${sanitizeText(formData.requesterPosition, '')} สังกัด ${sanitizeText(formData.requesterDepartment, '')}`;

const companions = Array.isArray(formData.companions) ? formData.companions : [];
const companionItems = companions
  .map((c) => {
    const name = sanitizeText(c?.name || '', '');
    const pos = sanitizeText(c?.position || '', '');
    return [name, pos].filter(Boolean).join(' ตำแหน่ง ');
  })
  .filter(Boolean);

const companionsPart = companionItems.length
  ? `พร้อมด้วย ${companionItems.join(', ')}`
  : '';

const timePart = formatTimeRange(formData.startTime, formData.endTime);
const travelPart = `ไปราชการเพื่อ ${sanitizeText(formData.purpose, '')} สถานที่ ${sanitizeText(formData.destination, '')} ระหว่างวันที่ ${formatDate(formData.startDate)} ถึง ${formatDate(formData.endDate)} รวม ${formData.durationDays} วัน เวลา ${timePart} พาหนะ ${sanitizeText(formData.transportDetails, '')}`;



  const closingPart = sanitizeText(formData.closingText, '');

  // Prepare text with Thai break hints
const introTextRaw = requesterPart;
const middleTextRaw = [companionsPart, travelPart].filter(Boolean).join(' ');
const fullMainRaw = [introTextRaw, middleTextRaw].filter(Boolean).join(' ');
  const lineGap = 2;
  const paragraphGap = 8;

  // Original width used for intro/closing (same as previous behavior)
  const originalWidth = state.contentWidth - (valueLeftX - PAGE_MARGIN.left) - 4;

  // FIX START: Use original Thai text without inserting invisible separators
  const introText = sanitizeText(introTextRaw, '');
  const middleText = sanitizeText(middleTextRaw, '');
  const fullMainText = sanitizeText(fullMainRaw, '');
  const closingText = sanitizeText(closingPart, '');
  // FIX END

  // Measure original main block height so we can preserve closing Y
  const originalMainHeight = doc.heightOfString(fullMainText, {
    width: originalWidth,
    lineGap
  });

  const closingHeight = doc.heightOfString(closingText, {
    width: originalWidth,
    lineGap
  });

  // Ensure page has space for the whole block (original main + closing)
  ensurePageSpace(doc, state, originalMainHeight + paragraphGap + closingHeight + 6);

  // Anchor positions
  const introY = state.cursorY; // fixed Y for intro

  // Intro: render at the 'เรียน' column using original width
  setBodyFont(doc, false);
  doc.text(introText, valueLeftX, introY, {
    width: originalWidth,
    lineGap,
    align: 'left'
  });

  const introHeight = doc.heightOfString(introText, {
    width: originalWidth,
    lineGap
  });

  // Middle: attempt to render wider across the page while keeping first-line indent
  const middleLeftX = PAGE_MARGIN.left + 2; // small inner margin
  const middleWidth = Math.max(20, state.contentWidth - 4);
  const middleIndent = Math.max(0, valueLeftX - middleLeftX); // keep first-line indent aligned with intro

  let middleHeight = doc.heightOfString(middleText, {
    width: middleWidth,
    lineGap,
    indent: middleIndent
  });

  // Amount of vertical space originally allocated to the main body after the intro
  let allowedMiddleHeight = originalMainHeight - introHeight - paragraphGap;
  if (allowedMiddleHeight < 0) allowedMiddleHeight = 0;

  // If the expanded middle would overflow the original space, fall back to original width to avoid overlap
 const middleY = introY + introHeight + 2;
 
  // วาด middle เต็มหน้าเลย ไม่ต้อง fallback
doc.text(middleText, middleLeftX, middleY, {
  width: middleWidth,
  lineGap,
  align: 'left',
  indent: 0
});

// คำนวณความสูงตาม width ใหม่
middleHeight = doc.heightOfString(middleText, {
  width: middleWidth,
  lineGap,
  indent: 0
});

  // Closing: keep at the same Y as the original layout (introY + originalMainHeight + paragraphGap)
  const closingY = middleY + middleHeight + paragraphGap;
  doc.text(closingText, valueLeftX, closingY, {
    width: originalWidth,
    lineGap,
    align: 'left'
  });

  // Advance cursor to just after closing so signature/approval sections remain in place
  state.cursorY = closingY + closingHeight + paragraphGap;
  // FIX END
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
  drawChoiceCircle(doc, x + 196, dividerY + 8, 'ไม่อนุมัติ', formData.approvalStatus === 'rejected');

  setBodyFont(doc, false);
  doc.text('ลงชื่อ', x + boxWidth - 220, dividerY + 24, { width: 34 });
  drawDottedRule(doc, x + boxWidth - 184, x + boxWidth - 12, dividerY + 42);

  doc.text(`(..............................................................................)`, x + boxWidth - 220, dividerY + 52, {
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
