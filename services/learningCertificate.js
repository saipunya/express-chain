const path = require('node:path');
const PDFDocument = require('@foliojs-fork/pdfkit');

const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' });
const font = (name) => path.join(__dirname, '../fonts', `Sarabun-${name}.ttf`);

function renderCertificate(res, progress) {
  const { enrollment, post } = progress;
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape', margin: 0,
    info: { Title: 'ใบรับรองผลการเรียน', Author: 'สำนักงานสหกรณ์จังหวัดชัยภูมิ' }
  });
  const { width, height } = doc.page;
  const inset = 80;
  const textWidth = width - inset * 2;
  const center = (text, y, size, weight = 'Regular', color = '#17382e') => {
    doc.font(font(weight)).fontSize(size).fillColor(color);
    while (size > 10 && doc.widthOfString(text) > textWidth) doc.fontSize(--size);
    doc.text(text, inset, y, { width: textWidth, align: 'center' });
  };

  res.attachment(`learning-${enrollment.certificate_code}.pdf`);
  doc.on('error', (error) => res.destroy(error));
  res.on('close', () => { if (!res.writableFinished) doc.destroy(); });
  doc.pipe(res);
  doc.rect(22, 22, width - 44, height - 44).lineWidth(1.5).stroke('#146448');
  doc.rect(30, 30, width - 60, height - 60).lineWidth(0.8).stroke('#b8cdc2');
  doc.roundedRect(width / 2 - 25, 77, 50, 5, 2.5).fill('#168457');

  center('สำนักงานสหกรณ์จังหวัดชัยภูมิ', 105, 17, 'Bold');
  center('ใบรับรองผลการเรียน', 149, 35, 'Bold');
  center('ขอรับรองว่า', 221, 16);
  center(enrollment.certificate_name, 255, 32, 'Bold');
  center('ผ่านการเรียนและการทดสอบในหลักสูตร', 315, 16);
  center(enrollment.certificate_course, 350, 25, 'Bold');
  center(`คะแนนหลังเรียน ${post.score}/${post.total} คะแนน`, 407, 16);
  center(`วันที่ผ่านหลักสูตร ${dateFormat.format(Number(post.submitted_ms))}`, 438, 15);
  doc.moveTo(170, 494).lineTo(width - 170, 494).stroke('#b8cdc2');
  center(`เลขที่ใบรับรอง ${enrollment.certificate_code}`, 514, 11, 'Regular', '#405b50');
  doc.end();
}

module.exports = renderCertificate;
