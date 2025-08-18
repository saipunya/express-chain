const express = require('express');
const router = express.Router();
const chamraController = require('../controllers/chamraController');

// List
router.get('/', chamraController.list);

// Add
router.get('/add', chamraController.addForm);
router.post('/add', chamraController.create);

// Edit
router.get('/edit/:c_code', chamraController.editForm);
router.post('/edit/:c_code', chamraController.update);

// Delete
router.post('/delete/:c_code', chamraController.delete);

module.exports = router;
