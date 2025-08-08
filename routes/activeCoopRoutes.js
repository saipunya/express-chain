const express = require('express');
const router = express.Router();
const activeCoopController = require('../controllers/activeCoopController');

router.get('/', activeCoopController.index);
router.get('/create', activeCoopController.createForm);
router.post('/create', activeCoopController.store);
router.get('/edit/:id', activeCoopController.editForm);
router.post('/edit/:id', activeCoopController.update);
router.get('/delete/:id', activeCoopController.delete);

module.exports = router;