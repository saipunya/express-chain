const express = require('express');
const router = express.Router();
const controller = require('../controllers/vongBusinessController');
const upload = require('../middlewares/vongBusinessMiddleware');
const { requireLogin } = require('../middlewares/authMiddleware');

router.get('/', controller.index);
router.get('/create', requireLogin, controller.showForm);
router.post('/create', requireLogin, upload.single('vongb_file'), controller.create);
router.get('/edit/:id', requireLogin, controller.editForm);
router.post('/edit/:id', requireLogin, upload.single('vongb_file'), controller.update);
router.get('/delete/:id', requireLogin, controller.delete);
router.get('/download/:id', controller.downloadFile);
router.get('/latest/json', controller.latestJson);

module.exports = router;
