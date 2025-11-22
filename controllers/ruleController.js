const multer = require('multer');
const ruleModel = require('../models/ruleModel');
const path = require('path');
const fs = require('fs');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const uploadPath = path.join(__dirname, '..', 'uploads', 'rule');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
  }
});
exports.upload = multer({ storage });

// หน้า upload rule
exports.showUploadForm = async (req, res) => {
  try {
    const recentUploads = await ruleModel.getLastUploads();
    const alls = await ruleModel.coopAll();
    
    res.render('uploadRule', {
      title: 'upload ข้อบังคับ',
      alls,
      recentUploads
    });
  } catch (err) {
    console.error('Error loading upload form:', err);
    res.status(500).send('upload พลาด');
  }
};

// POST upload rule
exports.uploadRule = async (req, res) => {
  try {
    const { rule_name, rule_code, rule_type, rule_year, er_no } = req.body;

    // จริงๆ rule_name ที่ได้จากฟอร์มควรเป็นรหัส c_code เพื่อดึงชื่อจริง
    const selectedCoop = await ruleModel.getCoopByCode(rule_code); 
    const actualRuleName = selectedCoop ? selectedCoop.c_name : rule_name;

    const file = req.file;
    if (!file) return res.status(400).send('ไม่พบไฟล์');

    const data = {
      rule_code: rule_code, // c_code
      rule_name: actualRuleName, // c_name
      rule_type,
      rule_year,
      er_no,
      rule_file: file.filename,
      rule_saveby: req.session.user?.fullname || 'unknown',
      rule_savedate: new Date()
    };
    
    await ruleModel.insertRule(data);
    res.redirect('/rule/upload');
  } catch (err) {
    console.error('Error uploading rule file:', err);
    res.status(500).send('ไม่สามารถ upload ได้');
  }
};


// ปรับ showListData ใช้ getRules แบบ page-based pagination
exports.showListData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const totalRules = await ruleModel.countRules(search);
    const totalPages = Math.ceil(totalRules / ruleModel.ITEMS_PER_PAGE);

    const alls = await ruleModel.getRules(search, page);

    res.render('rule', {
      alls,
      currentPage: page,
      totalPages,
      search
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).send('ข้อมูลไม่สำเร็จ');
  }
};

exports.showDetailData = async (req,res) => {
  try {
    const id = req.params.id;
    const detail = await ruleModel.detail(id);
    
    if (!detail) {
      return res.status(404).send('ไม่พบข้อมูล');
    }

    const filename = detail.rule_file;
    if (!filename) {
      return res.status(404).send('ไม่พบชื่อไฟล์ในฐานข้อมูล');
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'rule', filename);
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
    console.error('Error downloading rule file:', error);
    res.status(500).send('ข้อมูลไม่สำเร็จ');
  }
};

// ดาวน์โหลดหรือแสดงไฟล์ข้อบังคับตาม id
exports.downloadFile = async (req, res) => {
  try {
    const id = req.params.id;
    const detail = await ruleModel.detail(id);
    if (!detail) {
      return res.status(404).send('ไม่พบข้อมูลข้อบังคับนี้');
    }
    const filename = detail.rule_file;
    if (!filename) {
      return res.status(404).send('ไม่พบชื่อไฟล์ในฐานข้อมูล');
    }
    const filePath = path.join(__dirname, '..', 'uploads', 'rule', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไม่พบไฟล์ในระบบ');
    }
    // แสดง PDF ใน browser (inline)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(fs.readFileSync(filePath));
  } catch (error) {
    console.error('Error downloading rule file:', error);
    res.status(500).send('ข้อผิดพลาดในการดาวน์โหลดไฟล์');
  }
};

// delete
exports.deleteRule = async (req, res) => {
  try {
    const id = req.params.id;

    const filename = await ruleModel.getFilenameById(id);
    await ruleModel.deleteRule(id);

    if (filename) {
      const filePath = path.join(__dirname, '..', 'uploads', 'rule', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.redirect('/rule/upload');
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).send('ข้อมูลไม่สำเร็จ');
  }
};

exports.getCoopsByGroup = async (req, res) => {
  try {
    const group = req.params.group;
    const coops = await ruleModel.getCoopsByGroup(group);
    res.json(coops);
  } catch (err) {
    console.error('Error fetching coops by group:', err);
    res.status(500).json({ error: 'Error fetching coops by group' });
  }
};

const getAllRules = async () => {
  // ดึงข้อมูลทั้งหมดจากฐานข้อมูล
  const [rows] = await db.query('SELECT * FROM rule_table');
  return rows;
};

exports.index = async (req, res) => {
  const search = (req.query.search || '').trim();
  let alls = await getAllRules();

  if (search) {
    const keyword = search.toLowerCase();
    alls = alls.filter(item =>
      (item.c_name || '').toLowerCase().includes(keyword) ||
      (item.rule_year + '').includes(keyword) ||
      (item.er_no + '').includes(keyword)
    );
  }

  // Pagination
  const pageSize = 20;
  const totalPages = Math.ceil(alls.length / pageSize);
  const currentPage = parseInt(req.query.page || 1, 10);
  const pagedAlls = alls.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  res.render('rule', {
    alls: pagedAlls,
    totalPages,
    currentPage,
    search
  });
};
