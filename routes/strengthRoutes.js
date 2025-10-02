const express = require('express');
const router = express.Router();
const strengthController = require('../controllers/strengthController');
const csvUpload = require('../middleware/csvUpload');
const { requireLogin } = require('../middlewares/authMiddleware');

// PUBLIC endpoints (list + detail) so modal can load for non-auth users
router.get('/details', strengthController.getDetailsApi);
router.get('/:code', strengthController.showInstitutionDetail);

// PROTECTED endpoints (upload UI & import)
router.get('/', requireLogin, strengthController.showPage);
router.post('/import', requireLogin, csvUpload.single('file'), strengthController.importCsv);

module.exports = router;
