const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/rq2');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const { rq_year, rq_code } = req.body;
    const unique = Date.now();
    const safeCode = (rq_code || 'RQ2').toString().replace(/[^A-Za-z0-9_-]+/g, '-');
    const safeYear = (rq_year || 'YYYY').toString().replace(/[^0-9]/g, '');
    cb(null, `${safeYear}_${safeCode}_${unique}${ext}`);
  }
});

const upload = multer({ storage });

module.exports = upload;

