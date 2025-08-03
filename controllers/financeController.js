const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const financeModel = require('../models/financeModel');

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
      title: '�んปโหลดไฟล์งบ�ん',
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
      title: 'ไฟล์�ん้งหมด',
      fileAll,
      currentPage: page,
      totalPages,
      search
    });
  } catch (err) {
    console.error('Error loading finance files:', err);
    res.status(500).send('ข้อ�んพลาดในการโหลดข้อมูล');
  }
};

module.exports = {
  showUploadForm,
  uploadFinance,
  getCoopsByGroup,
  deleteFinance,
  loadFinance,
  upload
};
