const express = require('express');
const router = express.Router();
const controller = require('../controllers/sangketController');

// List + search + pagination
router.get('/', controller.index);

// Create
router.get('/create', controller.createForm);
router.post('/create', controller.create);

// View detail
router.get('/view/:id', controller.view);

// Edit
router.get('/edit/:id', controller.editForm);
router.post('/edit/:id', controller.update);

// Delete
router.post('/delete/:id', controller.delete);

module.exports = router;
