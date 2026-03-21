const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'pbt-plan');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeField = (file.fieldname || 'p_img').toString().replace(/[^A-Za-z0-9_-]+/g, '-');
    cb(null, `pbt-${safeField}-${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExt = /jpg|jpeg|png|gif|webp|pdf/;
  const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimetype =
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'application/pdf';

  if (extname && mimetype) {
    return cb(null, true);
  }

  cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพหรือ PDF'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});
