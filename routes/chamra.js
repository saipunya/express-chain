const express = require('express');
const router = express.Router();
const chamraController = require('../controllers/chamraController');
const { requireLogin } = require('../middlewares/authMiddleware'); // added

// Chamra main
router.get('/', chamraController.list);
router.post('/', chamraController.create);
router.get('/edit/:c_code', chamraController.editForm);
router.put('/:code', chamraController.update);
router.post('/delete/:c_code', chamraController.delete);
router.get('/detail/:c_code', chamraController.detail);

// Poblem
router.get('/poblem', chamraController.listPob);
router.get('/poblem/create', chamraController.createFormPob);
router.post('/poblem', chamraController.createPob);
router.get('/poblem/check', chamraController.checkPoblemExist);
router.get('/poblem/available', chamraController.getAvailableCoop);
router.post('/poblem/delete/:po_id', chamraController.deletePoblem);

// Process (protected)
router.get('/process', requireLogin, chamraController.processList);
router.get('/process/create', requireLogin, chamraController.processCreateForm);
router.post('/process/create', requireLogin, chamraController.processCreate);
router.get('/process/edit/:pr_id', requireLogin, chamraController.processEdit);
router.post('/process/edit/:pr_id', requireLogin, chamraController.processUpdate);
router.post('/process/delete/:pr_id', requireLogin, chamraController.processDelete);

module.exports = router;
