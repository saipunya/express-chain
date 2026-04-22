const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'promotion', 'prizes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    cb(null, `prize-${stamp}-${rand}${ext}`);
  }
});

const allowedMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

function fileFilter(req, file, cb) {
  if (!file || !file.mimetype) return cb(new Error('ไม่พบชนิดไฟล์ภาพ'), false);
  if (!allowedMimes.has(file.mimetype)) {
    return cb(new Error('รองรับเฉพาะไฟล์ภาพ JPG, PNG, WEBP, GIF เท่านั้น'), false);
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
