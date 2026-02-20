const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { uploadDownDir, watermarkFont } = require('../config/paths');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
]);

function validateUpload(file) {
  if (!file) return { ok: false, message: 'ไม่พบไฟล์อัปโหลด (req.file ว่าง)' };

  const original = (file.originalname || '').toLowerCase();
  const ext = path.extname(original);
  const mime = (file.mimetype || '').toLowerCase();

  // ต้องผ่านอย่างน้อย 1 เงื่อนไข (กันบาง client ส่ง mimetype เพี้ยน)
  const extOk = !!ext && ALLOWED_EXTENSIONS.has(ext);
  const mimeOk = !!mime && ALLOWED_MIME_TYPES.has(mime);

  if (!extOk && !mimeOk) {
    return { ok: false, message: `ชนิดไฟล์ไม่รองรับ: ext=${ext || '-'} mime=${mime || '-'}` };
  }
  return { ok: true };
}

function getDownFilePath(filename) {
  return path.join(uploadDownDir, filename);
}

function deleteIfExists(fullPath) {
  try {
    if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch {}
}

async function streamDownloadOrWatermarked(req, res, filename) {
  const fullPath = getDownFilePath(filename);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('ไม่พบไฟล์ในระบบ');
  }

  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const isAdmin = req.session?.user?.mClass === 'admin';

  if (!isPdf) {
    return res.download(fullPath, filename);
  }

  const pdfBytes = fs.readFileSync(fullPath);

  if (isAdmin) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(pdfBytes));
  }

  try {
    if (!fs.existsSync(watermarkFont)) {
      // Fallback: send original if font missing
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(Buffer.from(pdfBytes));
    }

    const fontBytes = fs.readFileSync(watermarkFont);
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
        color: rgb(0.92, 0.61, 0.61),
        opacity: 0.5,
        rotate: degrees(45)
      });
    });

    const finalPdf = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(finalPdf));
  } catch {
    // Fallback: send original if watermarking fails
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(pdfBytes));
  }
}

module.exports = {
  validateUpload,
  getDownFilePath,
  deleteIfExists,
  streamDownloadOrWatermarked
};
