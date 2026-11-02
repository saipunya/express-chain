const multer = require('./secureUpload');
const fs = require('fs');
const { uploadDownDir } = require('../config/paths');

fs.mkdirSync(uploadDownDir, { recursive: true });

const downStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDownDir),
});

const uploadDown = multer({
  storage: downStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: multer.fileFilter(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.png', '.jpg', '.jpeg'])
});

module.exports = { uploadDown };
