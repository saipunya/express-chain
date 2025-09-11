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

const allowed = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-rar-compressed'
];

const uploadDown = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('ชนิดไฟล์ไม่รองรับ'));
    }
    cb(null, true);
  }
});

module.exports = { uploadDown };
