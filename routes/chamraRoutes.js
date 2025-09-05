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

// add poblem
router.get('/poblem/add', chamraController.createFormPob);
router.post('/poblem/add', chamraController.createPob);

// show poblem
router.get('/poblem/', chamraController.listPob)

// check poblem exist
router.get('/poblem/check-exist', chamraController.checkPoblemExist);

// get available coop
router.get('/poblem/available-coop', chamraController.getAvailableCoop);




router.post('/poblem/delete/:po_id', chamraController.deletePoblem);

module.exports = router;
