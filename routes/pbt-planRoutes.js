const express = require('express');
const router = express.Router();
const controller = require('../controllers/pbtPlanController');
const upload = require('../middlewares/pbtPlanUpload');

router.get('/', controller.index);
router.get('/create', controller.createForm);
router.post('/create', upload.any(), controller.create);
router.get('/edit/:id', controller.editForm);
router.post('/edit/:id', upload.single('p_img'), controller.update);
router.post('/delete/:id', controller.delete);

module.exports = router;
