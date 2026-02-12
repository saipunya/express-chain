const express = require('express');
const router = express.Router();
const bigmeetController = require('../controllers/bigmeetController');

// List
router.get('/', bigmeetController.list);

// API endpoints for AJAX
router.get('/api/list', bigmeetController.apiList);
router.get('/api/:id', bigmeetController.get);

// Create
router.get('/new', bigmeetController.createForm);
router.post('/', bigmeetController.create);

// Edit
router.get('/edit/:id', bigmeetController.editForm);
router.post('/update/:id', bigmeetController.update);

// Delete
router.post('/delete/:id', bigmeetController.remove);

// Bulk operations
router.post('/api/bulk/create', bigmeetController.bulkCreate);
router.post('/api/bulk/update', bigmeetController.bulkUpdate);
router.post('/api/bulk/delete', bigmeetController.bulkDelete);

module.exports = router;