const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

exports.downloadFile = async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '..', 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('ไม่พบไฟล์');
  }

  const isAdmin = req.session.user && req.session.user.level === 'admin';

  if (isAdmin) {
    return res.download(filePath);
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const pages = pdfDoc.getPages();

    pages.forEach(page => {
      page.drawText('Confidential - สำหรับผู้ใช้ทั่วไป', {
        x: 50,
        y: 50,
        size: 20,
        color: rgb(1, 0, 0),
        opacity: 0.5,
        rotate: { degrees: 45 }
      });
    });

    const newPdfBytes = await pdfDoc.save();

    res.setHeader('Content-Disposition', `attachment; filename=watermarked-${filename}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(newPdfBytes));
  } catch (err) {
    console.error('เกิดข้อผิดพลาด:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการใส่ลายน้ำ');
  }
};
