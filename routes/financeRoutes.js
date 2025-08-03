const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { requireLogin } = require('../middlewares/authMiddleware');

// GET /finance - หน้าแสดงไฟล์
router.get('/', financeController.loadFinance);

// GET /finance/upload - หน้าปoload
router.get('/upload', requireLogin, financeController.showUploadForm);

// POST /finance/upload - ปoloadไฟล์
router.post('/upload', requireLogin, financeController.upload.single('file'), financeController.uploadFinance);

// GET /finance/coops/:group - API ข้อมูลสหกรณ์ตามกลุ่ม
router.get('/coops/:group', financeController.getCoopsByGroup);

// GET /finance/delete/:id - ลบไฟล์
router.get('/delete/:id', requireLogin, financeController.deleteFinance);

module.exports = router;
