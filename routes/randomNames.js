const express = require('express');
const multer = require('multer');
const router = express.Router();
const randomNamesController = require('../controllers/randomNamesController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isDocx = file.originalname.toLowerCase().endsWith('.docx') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    cb(isDocx ? null : new Error('รองรับเฉพาะไฟล์ .docx'), isDocx);
  }
});

function uploadDocx(req, res, next) {
  upload.single('docxFile')(req, res, (error) => {
    if (!error) {
      return next();
    }

    res.status(400).render('random-names/import', {
      title: 'นำเข้ารายชื่อนักเรียน',
      error: error.message || 'อัปโหลดไฟล์ไม่สำเร็จ',
      currentFileExists: false
    });
  });
}

router.get('/', randomNamesController.index);
router.get('/import', randomNamesController.importPage);
router.post('/import', uploadDocx, randomNamesController.importDocx);
router.get('/api/names', randomNamesController.names);

module.exports = router;
