const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const homeController = require('../controllers/homeController');
const { requireLogin } = require('../middlewares/authMiddleware');

// GET: แสดงหน้า upload form
router.get('/upload', financeController.showuploadForm);

// POST: รับไฟล์อัปโหลด
router.post('/upload', financeController.upload.single('file'), financeController.uploadFinance);

// GET: หน้าแสดงรายการไฟล์ทั้งหมด (ถ้ามี)
router.get('/finance', requireLogin, homeController.loadFinance);
router.get('/finance/view/:id', requireLogin, homeController.downloadById);
router.get('/coops/:group', financeController.getCoopsByGroup);

module.exports = router;
