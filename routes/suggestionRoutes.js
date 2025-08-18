const express = require('express');
const router = express.Router();
const controller = require('../controllers/suggestionController');
const upload = require('../middlewares/suggestionUpload');

router.get('/', controller.index);
router.get('/create', controller.createForm);
router.post('/create', upload.single('file'), controller.create);
router.get('/edit/:id', controller.editForm);
router.post('/edit/:id', upload.single('file'), controller.update);
router.post('/delete/:id', controller.delete);
router.get('/download/:id', controller.download);

module.exports = router;