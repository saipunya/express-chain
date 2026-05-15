const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middlewares/authMiddleware');
const controller = require('../controllers/sangketController');

router.use(requireLogin);

router.get('/', controller.index);
router.get('/report', controller.report);
router.get('/report.xlsx', controller.exportExcel);
router.get('/report.pdf', controller.exportPdf);
router.get('/import', controller.importForm);
router.post('/import', controller.upload.single('file'), controller.importExcel);

router.get('/create', controller.createForm);
router.post('/create', controller.create);

router.get('/cooperatives/:id', controller.cooperativeView);
router.get('/view/:id', controller.view);
router.post('/view/:id/actions', controller.addAction);
router.post('/view/:id/actions/:actionId/delete', controller.deleteAction);

router.get('/edit/:id', controller.editForm);
router.post('/edit/:id', controller.update);

router.post('/delete/:id', controller.delete);

module.exports = router;
