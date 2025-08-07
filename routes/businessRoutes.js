const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const { requireLogin } = require('../middlewares/authMiddleware');

router.get('/', businessController.loadBusiness);
router.get('/upload', requireLogin, businessController.showUploadForm);
router.post('/upload', requireLogin, businessController.upload.single('file'), businessController.uploadBusiness);
router.get('/coops/:group', businessController.getCoopsByGroup);
router.get('/delete/:id', requireLogin, businessController.deleteBusiness);
router.get('/download/:id', businessController.downloadFile);

module.exports = router;