const express = require('express');
const router = express.Router();
const addmemController = require('../controllers/addmemController');

// Verify controller is loaded
if (!addmemController || typeof addmemController.form !== 'function') {
  throw new Error('addmemController.form is not a function');
}

// GET: Show form for adding/editing
router.get('/add', addmemController.form);
router.get('/edit/:id', addmemController.form);

// POST: Save or Update
router.post('/save', addmemController.save);
router.post('/update/:id', addmemController.update);

// GET: List all
router.get('/list', addmemController.list);

// GET: View one
router.get('/view/:id', addmemController.viewOne);

// DELETE: Delete record
router.get('/delete/:id', addmemController.deleteAddmem);

module.exports = router;
