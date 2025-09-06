const express = require('express');
const router = express.Router();
const activeCoopController = require('../controllers/activeCoopController');
const { requireLogin } = require('../middlewares/authMiddleware');

router.get('/', activeCoopController.index);
router.get('/create', activeCoopController.createForm);
router.post('/create', activeCoopController.store);
router.get('/edit/:id',requireLogin, activeCoopController.editForm);
router.post('/edit/:id',requireLogin, activeCoopController.update);
router.get('/delete/:id', activeCoopController.delete);
router.get('/by-end-date', activeCoopController.listByEndDate);
router.get('/by-end-date/pdf', activeCoopController.exportEndDatePdf);
router.get('/by-end-date/pdf-wk', activeCoopController.exportEndDatePdfWk);
router.get('/by-end-date/pdf-make', activeCoopController.exportEndDatePdfMake);

module.exports = router;