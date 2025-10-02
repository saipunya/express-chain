const express = require('express');
const router = express.Router();
const strengthController = require('../controllers/strengthController');
const csvUpload = require('../middleware/csvUpload');
const { requireLogin } = require('../middlewares/authMiddleware');

// ใช้ middleware บังคับให้ล็อกอินก่อนทุก endpoint ใต้ /strength
router.use(requireLogin);

// แสดงหน้าอัพโหลด /strength
router.get('/', strengthController.showPage);
// นำเข้าไฟล์ CSV
router.post('/import', csvUpload.single('file'), strengthController.importCsv);
// API route for fetching per-institution strength list
router.get('/details', strengthController.getDetailsApi);
// Show per-institution strength detail by code
router.get('/:code', strengthController.showInstitutionDetail);

module.exports = router;
