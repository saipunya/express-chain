const multer = require('multer');
const path = require('path');
const fs = require('fs');

// สร้างโฟลเดอร์ถ้า<lemmaไม่<lemma
const uploadDir = path.join(__dirname, '..', 'uploads', 'suggestion');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'suggestion_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|txt|xlsx|xls/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.includes('spreadsheet') || file.mimetype.includes('document');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('<lemmaปโหลดได้เฉพาะไฟล์ PDF, DOC, DOCX, JPG, JPEG, PNG, TXT, XLS, XLSX เท่า<lemma้น'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

module.exports = upload;