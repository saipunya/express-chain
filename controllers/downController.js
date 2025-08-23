const downModel = require('../models/downModel');
const path = require('path');
const fs = require('fs');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

exports.list = async (req, res) => {
  const search = req.query.search || '';
  const downs = await downModel.searchBySubject(search);
  res.render('down/list', { downs, search, user: req.session.user });
};

exports.view = async (req, res) => {
  const down = await downModel.getById(req.params.id);
  res.render('down/view', { down });
};

exports.createForm = (req, res) => {
  res.render('down/create');
};

exports.create = async (req, res) => {
  let down_file = '-';
  if (req.file) {
    down_file = req.file.filename;
  }
  await downModel.create({
    ...req.body,
    down_file,
    down_savedate: req.body.down_savedate || new Date().toISOString().slice(0, 10)
  });
  res.redirect('/down');
};

exports.editForm = async (req, res) => {
  const down = await downModel.getById(req.params.id);
  res.render('down/edit', { down });
};

exports.update = async (req, res) => {
  let down_file = req.body.down_file || '-';
  if (req.file) {
    down_file = req.file.filename;
  }
  await downModel.update(req.params.id, {
    ...req.body,
    down_file,
    down_savedate: req.body.down_savedate || new Date().toISOString().slice(0, 10)
  });
  res.redirect('/down');
};

exports.delete = async (req, res) => {
  await downModel.delete(req.params.id);
  res.redirect('/down');
};

exports.download = async (req, res) => {
  const down = await downModel.getById(req.params.id);
  if (!down || !down.down_file || down.down_file === '-') {
    return res.status(404).send('ไม่พบไฟล์');
  }

  const filePath = path.join(__dirname, '..', 'uploads', 'down', down.down_file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('ไม่พบไฟล์ในระบบ');
  }

  // ตรวจสอบนามสกุลไฟล์
  if (!down.down_file.toLowerCase().endsWith('.pdf')) {
    // ไม่ใช่ PDF ส่งไฟล์ตรง ๆ
    return res.download(filePath, down.down_file);
  }

  const isAdmin = req.session?.user?.mClass === 'admin';
  const pdfBytes = fs.readFileSync(filePath);
  let finalPdfBytes;

  if (isAdmin) {
    finalPdfBytes = pdfBytes;
  } else {
    // ใส่ลายน้ำ
    const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
    if (!fs.existsSync(fontPath)) {
      return res.status(500).send('ไม่พบฟอนต์สำหรับลายน้ำ');
    }
    const fontBytes = fs.readFileSync(fontPath);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const customFont = await pdfDoc.embedFont(fontBytes);
    const pages = pdfDoc.getPages();

    const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิเท่านั้น';

    pages.forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 2 - 100,
        y: height / 2,
        size: 25,
        font: customFont,
        color: rgb(0.92, 0.61, 0.61), // ✅ ใช้ค่าสีระหว่าง 0-1
        opacity: 0.5,
        rotate: degrees(45)
      });
    });

    finalPdfBytes = await pdfDoc.save();
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${down.down_file}"`);
  res.send(Buffer.from(finalPdfBytes));
};