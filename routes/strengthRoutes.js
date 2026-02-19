const express = require('express');
const router = express.Router();
const strengthController = require('../controllers/strengthController');
const csvUpload = require('../middleware/csvUpload');
const { requireLogin } = require('../middlewares/authMiddleware');
const strengthSummaryController = require('../controllers/strengthSummaryController');

// PUBLIC endpoints
router.get('/list', strengthController.showListPage);
router.get('/details', strengthController.getDetailsApi);
router.get('/:code', strengthController.showInstitutionDetail);

// Summary route
router.get('/summary', strengthSummaryController.getSummary);

// PROTECTED endpoints (upload UI & import)
router.get('/', requireLogin, strengthController.showPage);
router.post('/import', requireLogin, csvUpload.single('file'), strengthController.importCsv);

module.exports = router;
