const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/vong_business');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeCode = String(req.body.vongb_code || 'file').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const safeYear = String(req.body.vongb_year || new Date().getFullYear()).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const uniqueSuffix = Date.now();
    const filename = `${safeCode}_${safeYear}_${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

module.exports = upload;
