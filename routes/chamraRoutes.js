const express = require('express');
const router = express.Router();
const chamraController = require('../controllers/chamraController');
const { requireLogin } = require('../middlewares/authMiddleware');

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

// add poblem
router.get('/poblem/add', chamraController.createFormPob);
router.post('/poblem/add', chamraController.createPob);

// show poblem
router.get('/poblem/', chamraController.listPob)

// check poblem exist
router.get('/poblem/check-exist', chamraController.checkPoblemExist);

// get available coop
router.get('/poblem/available-coop', chamraController.getAvailableCoop);

// ---- chamra_process routes ----
router.get('/process',requireLogin, chamraController.processList);
router.post('/process/:pr_id/update', chamraController.processUpdate);
router.post('/process/:pr_id/delete', chamraController.processDelete);
// (optional separate edit page)
// router.get('/process/edit/:pr_id', chamraController.processEdit);

router.get('/process/add', requireLogin, chamraController.processCreateForm);
router.post('/process/add', requireLogin, chamraController.processCreate);

router.post('/poblem/delete/:po_id', chamraController.deletePoblem);

// Detail (new)
router.get('/detail/:c_code', chamraController.detail);

module.exports = router;
