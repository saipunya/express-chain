const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const financeModel = require('../models/financeModel');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

const uploadPath = path.join(__dirname, '..', 'uploads', 'finance');

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}-${originalName}`);
  },
});

const upload = multer({ storage });

const showUploadForm = async (req, res) => {
  try {
    const recentUploads = await financeModel.getLastUploads();
    res.render('uploadFinance', { 
      title: 'ข้อมูลงบการเงิน',
      recentUploads
    });
  } catch (err) {
    console.error('Error showing upload form:', err);
    res.status(500).send('Error showing upload form');
  }
};

const uploadFinance = async (req, res) => {
  try {
    const { c_code, c_name, end_year } = req.body;
    const user = req.session.user?.fullname || 'unknown';
    const file = req.file;
    if (!file) return res.status(400).send('File is required');

    const data = {
      c_code,
      c_name,
      end_year,
      file_name: file.filename,
      link_file: `/uploads/finance/${file.filename}`,
      saveby: user,
      savedate: new Date(),
    };

    await financeModel.insertFile(data);
    res.redirect('/finance');
  } catch (err) {
    console.error('Error uploading finance file:', err);
    res.status(500).send('Error uploading finance file');
  }
};

const getCoopsByGroup = async (req, res) => {
  try {
    const group = req.params.group;
    const coops = await financeModel.getCoopsByGroup(group);
    res.json(coops);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching coops by group' });
  }
};

const deleteFinance = async (req, res) => {
  try {
    const id = req.params.id;
    const filename = await financeModel.getFilenameById(id);
    if (filename) {
      const filePath = path.join(uploadPath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await financeModel.deleteFile(id);
    res.redirect('/finance');
  } catch (error) {
    res.status(500).send('Error deleting finance file');
  }
};

const loadFinance = async (req, res) => {
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
    res.status(500).send('ผิดพลาดในการโหลดข้อมูล');
  }
};



const downloadFile = async (req, res) => {
  try {
    const id = req.params.id;
    const file = await financeModel.getFileById(id);
    
    if (!file) {
      return res.status(404).send('ไม่พบไฟล์');
    }
    
    const filePath = path.join(uploadPath, file.file_name);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไฟล์ไม่มีอยู่ในระบบ');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes;

    if (isAdmin) {
      // Admin: ไม่ใส่ลายน้ำ
      finalPdfBytes = pdfBytes;
    } else {
      // User: ใส่ลายน้ำ
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      const watermarkText = 'ใช้ในราชการกรมส่งเสริมสหกรณ์เท่านั้น';

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

    // แสดง PDF ใน browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
    res.send(Buffer.from(finalPdfBytes));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('<|im_start|>ี่พลาดในการดาวน์โหลด');
  }
};

module.exports = {
  showUploadForm,
  uploadFinance,
  getCoopsByGroup,
  deleteFinance,
  loadFinance,
  upload,
  downloadFile
};
