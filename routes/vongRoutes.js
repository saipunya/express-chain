const express = require('express');
const router = express.Router();
const controller = require('../controllers/vongController');

router.get('/', controller.index);
router.get('/create', controller.showForm);
router.post('/create', controller.create);
router.get('/edit/:id', controller.editForm);
router.post('/edit/:id', controller.update);
router.get('/delete/:id', controller.delete);
router.get('/download/:id', controller.downloadFile);

module.exports = router;
