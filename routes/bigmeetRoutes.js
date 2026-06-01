const express = require('express');
const router = express.Router();
const bigmeetController = require('../controllers/bigmeetController');
const bigmeetUpload = require('../middleware/bigmeetUpload');

// List
router.get('/', bigmeetController.list);
router.get('/summary', bigmeetController.summaryByFiscalYear);
router.get('/summary/detail', bigmeetController.summaryDetail);
router.get('/accounting-year-counts/detail', bigmeetController.accountingYearCountDetail);
router.get('/accounting-year-counts', bigmeetController.accountingYearCounts);

// API endpoints for AJAX
router.get('/api/list', bigmeetController.apiList);
router.get('/api/:id', bigmeetController.get);

// Create
router.get('/new', bigmeetController.createForm);
router.post('/', bigmeetController.create);
router.post('/import', bigmeetUpload.single('file'), bigmeetController.importExcel);

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
