const express = require('express');
const router = express.Router();
const bigmeetController = require('../controllers/bigmeetController');

// List
router.get('/', bigmeetController.list);

// Create
router.get('/new', bigmeetController.createForm);
router.post('/', bigmeetController.create);

// Edit
router.get('/edit/:id', bigmeetController.editForm);
router.post('/update/:id', bigmeetController.update);

// Delete
router.post('/delete/:id', bigmeetController.remove);

module.exports = router;