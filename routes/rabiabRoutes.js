const express = require('express');
const router = express.Router();
const multer = require('../middleware/secureUpload');
const rabiabController = require('../controllers/rabiabController');
const { requireLogin , requireLevel } = require('../middlewares/authMiddleware');


// ตั้งค่า multer<|im_start|><|im_start|>ปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/rabiab/');
  },
});

const upload = multer({ 
  storage: storage,
  fileFilter: multer.fileFilter(['.pdf'])
});

// เ่่ม route API ก่อน route อื่นๆ
router.get('/coops/:group', rabiabController.getCoopsByGroup);

// Routes อื่นๆ
router.get('/', requireLogin, rabiabController.index);
// router.get('/', requireLevel(['admin', 'kjs']), rabiabController.index);
router.get('/upload', requireLogin, rabiabController.uploadForm);
router.post('/upload', requireLogin, upload.single('file'), rabiabController.uploadRabiab);
router.get('/download/:id', requireLogin, rabiabController.downloadRabiab);
router.post('/delete/:id', requireLevel(['admin', 'kjs']), rabiabController.deleteRabiab);

module.exports = router;
