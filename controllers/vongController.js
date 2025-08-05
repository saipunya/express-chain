const Vong = require('../models/vongModel');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

exports.index = async (req, res) => {
  const data = await Vong.getAll();
  res.render('vong/index', { data });
};

exports.showForm = async (req, res) => {
  res.render('vong/form', { vong: null });
};

exports.editForm = async (req, res) => {
  const vong = await Vong.getById(req.params.id);
  res.render('vong/form', { vong });
};

exports.create = async (req, res) => {
  await Vong.create(req.body);
  res.redirect('/vong');
};

exports.update = async (req, res) => {
  await Vong.update(req.params.id, req.body);
  res.redirect('/vong');
};

exports.delete = async (req, res) => {
  await Vong.delete(req.params.id);
  res.redirect('/vong');
};

exports.downloadFile = async (req, res) => {
  try {
    const id = req.params.id;
    const vong = await Vong.getById(id);
    
    if (!vong) {
      return res.status(404).send('ไม่พบข้อมูล');
    }
    
    const filename = vong.vong_filename;
    const filePath = path.join(__dirname, '..', 'uploads', 'vong', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไม่พบไฟล์');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes;

    if (isAdmin) {
      finalPdfBytes = pdfBytes;
    } else {
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';

      pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 4,
          y: height / 2,
          size: 30,
          font: customFont,
          color: rgb(1, 0, 0),
          opacity: 0.3,
          rotate: degrees(45)
        });
      });

      finalPdfBytes = await pdfDoc.save();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(finalPdfBytes));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('ข้อ<lemmaพลาดในการดาวน์โหลด');
  }
};
