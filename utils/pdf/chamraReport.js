const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

module.exports = async function generateChamraReport(res, payload) {
  const { q = '', rows = [], generatedAt, printedBy } = payload || {};
  const created = generatedAt ? new Date(generatedAt) : new Date();

  // Resolve Thai-capable fonts with fallbacks (project assets -> Windows fonts)
  const assetsFontsDir = path.join(__dirname, '../../assets/fonts');
  const winFontsDir = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const pickFirst = (paths) => paths.find(p => { try { return fs.existsSync(p); } catch { return false; } });

  // Prefer TH Sarabun New explicitly
  const regularCandidates = [
    path.join(assetsFontsDir, 'THSarabunNew.ttf'),
    path.join(winFontsDir, 'THSarabunNew.ttf'),
    // fallbacks
    path.join(assetsFontsDir, 'Sarabun-Regular.ttf'),
    path.join(winFontsDir, 'Sarabun-Regular.ttf'),
    path.join(assetsFontsDir, 'NotoSansThai-Regular.ttf'),
    path.join(winFontsDir, 'NotoSansThai-Regular.ttf'),
    path.join(winFontsDir, 'Tahoma.ttf') // widely available on Windows and supports Thai
  ];
  const boldCandidates = [
    path.join(assetsFontsDir, 'THSarabunNew-Bold.ttf'),
    path.join(winFontsDir, 'THSarabunNew-Bold.ttf'),
    // fallbacks
    path.join(assetsFontsDir, 'Sarabun-Bold.ttf'),
    path.join(winFontsDir, 'Sarabun-Bold.ttf'),
    path.join(assetsFontsDir, 'NotoSansThai-Bold.ttf'),
    path.join(winFontsDir, 'NotoSansThai-Bold.ttf'),
    path.join(winFontsDir, 'TahomaBD.ttf')
  ];

  const regularFont = pickFirst(regularCandidates);
  const boldFont = pickFirst(boldCandidates) || regularFont;

  if (!regularFont) {
    console.error('No Thai-capable font found. Checked:', regularCandidates);
    res.status(500).json({
      error: 'Thai font not found',
      hint: 'Place THSarabunNew.ttf (or Sarabun/NotoSansThai/Tahoma) in assets/fonts or ensure Windows fonts are available.'
    });
    return;
  }

  // Use THSarabun family name in pdfmake
  const fonts = {
    THSarabun: {
      normal: regularFont,
      bold: boldFont,
      italics: regularFont,
      bolditalics: boldFont
    }
  };

  const printer = new PdfPrinter(fonts);

  // Build table body
  const header = [
    { text: '#', style: 'tableHeader' },
    { text: 'ชื่อ', style: 'tableHeader' },
    { text: 'สถานะ', style: 'tableHeader' },
    { text: 'ขั้น', style: 'tableHeader' },
    { text: 'ผู้ชำระบัญชี', style: 'tableHeader' }
  ];

  const body = [header];
  rows.forEach((r, i) => {
    body.push([
      { text: String(i + 1), style: 'cell' },
      { text: r.name ? String(r.name).replace(/\//g, '\n') : '-', style: 'cell' },
      { text: r.status ? String(r.status).replace(/\//g, '\n') : '-', style: 'cell' },
      { text: r.latestStepNumber ? String(r.latestStepNumber) : '-', style: 'cell', alignment: 'center' },
      { text: r.person ? String(r.person).replace(/\//g, '\n') : '-', style: 'cell' }
    ]);
  });

  const total = rows.length;
  const withdrawn = rows.filter(r => String(r.status || '').includes('ถอนชื่อ')).length;
  const running = total - withdrawn;

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [36, 36, 36, 36],
    header(currentPage, pageCount) {
      return {
        text: `หน้า ${currentPage}/${pageCount}`,
        alignment: 'right',
        margin: [36, 12, 36, 0],
        fontSize: 10,
        color: '#6c757d' // muted
      };
    },
    footer(currentPage, pageCount) {
      return {
        columns: [
          { text: `พิมพ์โดย: ${printedBy || 'ผู้ใช้งานทั่วไป'}`, alignment: 'left' },
          { text: `วันที่ส่งออก: ${created.toLocaleString('th-TH')}`, alignment: 'right' }
        ],
        margin: [36, 0, 36, 12],
        fontSize: 10,
        color: '#6c757d'
      };
    },
    defaultStyle: { font: 'THSarabun', fontSize: 12 },
    styles: {
      title: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
      meta: { fontSize: 11, margin: [0, 0, 0, 2] },
      summary: { fontSize: 11, margin: [0, 6, 0, 6] },
      tableHeader: { bold: true, fillColor: '#e9ecef', margin: [0, 2, 0, 2] },
      cell: { margin: [0, 2, 0, 2] }
    },
    content: [
      { text: 'รายงานสรุปสถานะการชำระบัญชีสหกรณ์และกลุ่มเกษตรกร', style: 'title' },
  
      { text: `สรุปจำนวน: ทั้งหมด ${total} | กำลังชำระบัญชี ${running} | ถอนชื่อแล้ว ${withdrawn}`, style: 'summary' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 120, 50, '*'], // # | ชื่อ | สถานะ | ขั้น | ผู้ชำระบัญชี
          body
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#e9ecef' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#bdbdbd',
          vLineColor: () => '#bdbdbd',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 2,
          paddingBottom: () => 2
        }
      }
    ]
  };

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="chamra-report-${Date.now()}.pdf"`);

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  pdfDoc.pipe(res);
  pdfDoc.end();

  await new Promise((resolve) => pdfDoc.on('end', resolve));
};
