const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const homeController = require('../controllers/homeController');
const { requireLogin } = require('../middlewares/authMiddleware');

// GET: แสดงหน้า upload form
router.get('/upload', financeController.showuploadForm);

// POST: ไฟล์ ปoload
router.post('/upload', financeController.upload.single('file'), financeController.uploadFinance);

// GET: หน้าแสดงรายการไฟล์ งหมด (ถ้า)
router.get('/finance', homeController.loadFinance);
router.get('/finance/view/:id', requireLogin, homeController.downloadById);
router.get('/coops/:group', financeController.getCoopsByGroup);

module.exports = router;
