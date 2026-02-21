const express = require('express');
const router = express.Router();
const turnoverController = require('../controllers/turnoverController');
const turnoverUpload = require('../middleware/turnoverUpload');
const { requireLogin } = require('../middlewares/authMiddleware');

router.use(requireLogin);

router.get('/', turnoverController.showImportForm);
router.post('/import', turnoverUpload.single('file'), turnoverController.importExcel);

module.exports = router;
