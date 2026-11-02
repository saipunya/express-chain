const multer = require('../middleware/secureUpload');
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
});

const fileFilter = multer.fileFilter(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt', '.xlsx', '.xls']);

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

module.exports = upload;