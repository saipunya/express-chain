const path = require('path');
const fs = require('fs');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

const allfiles = require('../models/homeModel');
const financeModel = require('../models/financeModel');

exports.index = async (req, res) => {
  try {
    const allFiles = await allfiles.listFiles();
    res.render('home', {
      title: 'หน้าแรก - CoopChain ชัยภูมิ',
      fileAll: allFiles
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงไฟล์');
  }
};

exports.downloadById = async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await allfiles.getFileById(fileId);
    if (!file) {
      return res.status(404).send('ไม่พบไฟล์');
    }

    const filename = path.basename(file.file_name);
    const filePath = path.join(__dirname, '..', 'uploads', 'finance', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไม่พบไฟล์จริงในระบบ');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes;

    if (isAdmin) {
      // 🔹 Admin: ไม่มีลายน้ำ
      finalPdfBytes = pdfBytes;
    } else {
      // 🔸 ผู้ใช้ทั่วไป: เพิ่มลายน้ำ
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      const watermarkText = 'ใช้สำหรับสำนักงานสหกรณ์จังหวัดชัยภูมิเท่านั้น !';

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

    // ✅ แสดง PDF ใน browser (inline)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(finalPdfBytes));
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการแสดงไฟล์');
  }
};
exports.loadFinance = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const totalFiles = await financeModel.countFinanceFiles(search);
    const totalPages = Math.ceil(totalFiles / financeModel.ITEMS_PER_PAGE);

    const fileAll = await financeModel.getFinanceFiles(search, page);

    res.render('loadFinance', {
      title: 'ไฟล์ทั้งหมด',
      fileAll,
      currentPage: page,
      totalPages,
      search
    });
  } catch (err) {
    console.error('Error loading finance files:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};