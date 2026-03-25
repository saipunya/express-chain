const express = require('express');
const router = express.Router();
const controller = require('../controllers/vongBusinessController');
const upload = require('../middlewares/vongBusinessMiddleware');

router.get('/', controller.index);
router.get('/create', controller.showForm);
router.post('/create', upload.single('vongb_file'), controller.create);
router.get('/edit/:id', controller.editForm);
router.post('/edit/:id', upload.single('vongb_file'), controller.update);
router.get('/delete/:id', controller.delete);
router.get('/download/:id', controller.downloadFile);
router.get('/latest/json', controller.latestJson);

module.exports = router;
