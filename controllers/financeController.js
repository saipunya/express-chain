const multer = require('multer');
const financeModel = require('../models/financeModel');
const path = require('path');
const db = require('../config/db'); // Assuming you have a db config file
const uploadPath = path.join(__dirname, '..', 'uploads', 'finance');
// const coopModel = require('../models/coopModel'); // Assuming you have a coop model for fetching coops



const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
  }
});
exports.upload = multer({ storage });

// หน้าอัปโหลด
exports.showuploadForm = async (req, res) => {
    try {
      const coops = await financeModel.getAllCoops(); // ดึงข้อมูล active_coop
      const recentUploads = await financeModel.getLastUploads(); // ดึงไฟล์ล่าสุด
  
      res.render('uploadFinance', {
        title: 'อัปโหลดเอกสารการเงิน',
        coops,
        recentUploads
      });
    } catch (err) {
      console.error('Error loading upload form:', err);
      res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์ม');
    }
  };

// POST อัปโหลด
exports.uploadFinance = async (req, res) => {
    try {
      const {
        c_code, c_name, end_year
      } = req.body;
  
      const user = req.session.user?.fullname || 'unknown';
      const file = req.file;
  
      if (!file) return res.status(400).send('กรุณาเลือกไฟล์');
  
      const data = {
        c_code,
        c_name,
        end_year,
        file_name: file.filename,
        link_file: `/uploads/finance/${file.filename}`,
        saveby: user,
        savedate: new Date()
      };
  
      await financeModel.insertFile(data);
  
      res.redirect('/finance');
    } catch (err) {
      console.error('Error uploading finance file:', err);
      res.status(500).send('เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
    }
  };
  
  exports.lastUpload = async (req, res) => {
    try {
      // ดึงข้อมูลสหกรณ์ทั้งหมดเพื่อแสดงใน dropdown
      const [coops] = await db.query('SELECT c_code, c_name FROM cooperatives WHERE c_status = "active"');
  
      // ดึง 5 รายการไฟล์ที่อัปโหลดล่าสุด
      const [recentUploads] = await db.query(
        'SELECT c_name, end_year, file_name, created_at FROM finance_uploads ORDER BY created_at DESC LIMIT 5'
      );
  
      res.render('uploadFinance', {
        title: 'อัปโหลดเอกสารการเงิน',
        coops, // ส่งข้อมูลสหกรณ์เข้า view
        recentUploads // ส่งตัวนี้เข้า view
      });
    } catch (error) {
      console.error('Error loading upload form:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  // API: GET /finance/coops/:group
exports.getCoopsByGroup = async (req, res) => {
  const group = req.params.group;
  try {
    const coops = await financeModel.getCoopsByGroup(group);
    res.json(coops);
  } catch (err) {
    console.error('Error fetching coops by group:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสหกรณ์ได้' });
  }
};
