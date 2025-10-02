const express = require('express');
const router = express.Router();
const strengthController = require('../controllers/strengthController');
const csvUpload = require('../middleware/csvUpload');

// แสดงหน้าอัพโหลด /strength
router.get('/', strengthController.showPage);
// นำเข้าไฟล์ CSV
router.post('/import', csvUpload.single('file'), strengthController.importCsv);

module.exports = router;
