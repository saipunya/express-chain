const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(process.cwd(), 'uploads', 'strength');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype) && !file.originalname.endsWith('.csv')) {
      return cb(new Error('รองรับเฉพาะไฟล์ .csv'));
    }
    cb(null, true);
  }
});
