const express = require('express');
const router = express.Router();
const downController = require('../controllers/downController');
const { uploadDown } = require('../middleware/upload');
const { authorizeRoles } = require('../middleware/auth');

router.get('/', downController.list);
router.get('/view/:id', downController.view);

router.get('/create', authorizeRoles('admin', 'kts'), downController.createForm);
router.post('/create', authorizeRoles('admin', 'kts'), uploadDown.single('down_file'), downController.create);

router.get('/edit/:id', authorizeRoles('admin', 'kts'), downController.editForm);
router.post('/edit/:id', authorizeRoles('admin', 'kts'), uploadDown.single('down_file'), downController.update);

router.post('/delete/:id', authorizeRoles('admin', 'kts'), downController.delete);

router.get('/download/:id', downController.download);

router.get('/search', downController.search);
router.get('/top10', downController.top10);

module.exports = router;