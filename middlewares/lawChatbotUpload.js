const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'lawChatbot');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `lawchatbot-${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  }
});

function fileFilter(req, file, cb) {
  const isPdfMime = String(file.mimetype || '').toLowerCase() === 'application/pdf';
  const isPdfExt = path.extname(file.originalname || '').toLowerCase() === '.pdf';

  if (isPdfMime && isPdfExt) {
    return cb(null, true);
  }

  return cb(new Error('อนุญาตเฉพาะไฟล์ PDF เท่านั้น'));
}

module.exports = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter
});
