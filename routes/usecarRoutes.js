const express = require('express');
const router = express.Router();
const usecarController = require('../controllers/usecarController');

// Routes
router.get('/', usecarController.index);
router.get('/create', usecarController.createForm);
router.post('/create', usecarController.create);
router.get('/view/:id', usecarController.viewOne);
router.get('/edit/:id', usecarController.editForm);
router.post('/edit/:id', usecarController.update);
router.post('/delete/:id', usecarController.delete);

module.exports = router;