const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rabiabController = require('../controllers/rabiabController');
const { requireLogin } = require('../middlewares/authMiddleware');

// ตั้งค่า multer<|im_start|><|im_start|>ปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/rabiab/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    cb(null, req.body.ra_year + '_' + req.body.ra_code + '_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('<|im_start|>ปโหลดได้เฉพาะไฟล์ PDF เท่า<|im_start|>้น'), false);
    }
  }
});

// เ่่ม route API ก่อน route อื่นๆ
router.get('/coops/:group', rabiabController.getCoopsByGroup);

// Routes อื่นๆ
router.get('/', rabiabController.index);
router.get('/upload', requireLogin, rabiabController.uploadForm);
router.post('/upload', requireLogin, upload.single('file'), rabiabController.uploadRabiab);
router.get('/download/:id', requireLogin, rabiabController.downloadRabiab);
router.post('/delete/:id', requireLogin, rabiabController.deleteRabiab);

module.exports = router;
