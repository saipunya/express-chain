const path = require('path');
const fs = require('fs');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const db = require('../config/db');

const allfiles = require('../models/homeModel');
const financeModel = require('../models/financeModel');
const coopModel = require('../models/coopModel');
const ruleModel = require('../models/ruleModel');
const UseCar = require('../models/usecarModel');

// controllers/homeController.js

const allfiles2 = require('../models/allfilesModel');
const Finance = require('../models/financeModel');

const homeController = {
  index: async (req, res) => {
    try {
      const finances = await Finance.getAll();
      const ruleFiles = await ruleModel.getLastUploads();
      const usecars = await UseCar.getAll();
      
      // ข้อมูล สหกรณ์
      const coopStats = await coopModel.getCoopStats();
      const closingCount = await coopModel.getClosingStats();
      
      // แปลงข้อมูลให้ใช้งานง่าย
      const stats = {
        coop: coopStats.find(item => item.coop_group === 'สหกรณ์')?.count || 0,
        farmer: coopStats.find(item => item.coop_group === 'กลุ่มเกษตรกร')?.count || 0,
        closing: closingCount
      };
      
      res.render('home', { 
        finances, 
        ruleFiles,
        usecars,
        stats
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).send('Error fetching data');
    }
  },
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
      return res.status(404).send('ไม่พบไฟล์ในระบบ');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes;

    if (isAdmin) {
      // 🔹 Admin: ไม่ลายน้ำ
      finalPdfBytes = pdfBytes;
    } else {
      // 🔸 ้ใช้ วไป: เ่่มลายน้ำ
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      const watermarkText = 'ใช้สหกรณ์เท่า้น !';

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
    res.status(500).send('ข้อพลาดในการแสดงไฟล์');
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
      title: 'ไฟล์หมด',
      fileAll,
      currentPage: page,
      totalPages,
      search
    });
  } catch (err) {
    console.error('Error loading finance files:', err);
    res.status(500).send('ข้อพลาดในการโหลดข้อมูล');
  }
};



exports.showDashboard = async (req, res) => {
  try {
    const [statusStats] = await db.query(`
      SELECT coop_group, c_status, COUNT(*) AS total
      FROM active_coop
      GROUP BY coop_group, c_status
    `);

    const [groupStats] = await db.query(`
      SELECT c_group, COUNT(*) AS total
      FROM active_coop
      GROUP BY c_group
    `);

    const [typeStats] = await db.query(`
      SELECT coop_group, c_type, COUNT(*) AS total
      FROM active_coop
      GROUP BY coop_group, c_type
    `);

    res.render('home', {
      statusStats,
      groupStats,
      typeStats
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).send('Server Error');
  }
};

module.exports = homeController;
