const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/project');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const { pro_year, pro_no } = req.body;
    const unique = Date.now();
    // Sanitize pro_no to avoid slashes or unsafe chars in filenames
    const safeNo = (pro_no || 'NO').toString().replace(/[^A-Za-z0-9_-]+/g, '-');
    const safeYear = (pro_year || 'YYYY').toString().replace(/[^0-9]/g, '');
    cb(null, `${safeYear}_${safeNo}_${unique}${ext}`);
  }
});

const upload = multer({ storage });

module.exports = upload;

