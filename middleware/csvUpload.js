const multer = require('./secureUpload');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(process.cwd(), 'uploads', 'strength');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
});
module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: multer.fileFilter(['.csv'])
});
