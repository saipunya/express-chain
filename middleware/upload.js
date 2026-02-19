const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadDownDir } = require('../config/paths');

fs.mkdirSync(uploadDownDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDownDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const uploadDown = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-rar-compressed',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.png', '.jpg', '.jpeg'];

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('ชนิดไฟล์ไม่รองรับ'));
    }
  }
});

module.exports = { uploadDown };
