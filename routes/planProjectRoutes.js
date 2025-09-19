const express = require('express');
const router = express.Router();
const controller = require('../controllers/planProjectController');

router.get('/', controller.listPage);
router.get('/new', controller.newPage);
router.post('/', controller.create);
router.get('/edit/:id', controller.editPage);
router.post('/edit/:id', controller.update);
router.post('/delete/:id', controller.delete);

module.exports = router;
