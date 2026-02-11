const express = require('express');
const router = express.Router();
const addmemController = require('../controllers/addmemController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');
// Verify controller is loaded
if (!addmemController || typeof addmemController.form !== 'function') {
  throw new Error('addmemController.form is not a function');
}

// GET: Show form for adding/editing
router.get('/add', requireLogin, addmemController.form);

router.get('/edit/:id', requireLogin, addmemController.form);

// POST: Save or Update
router.post('/save', requireLogin, addmemController.save);
router.post('/update/:id', requireLogin, addmemController.update);

// GET: List all
router.get('/list', requireLogin, addmemController.list);

// GET: View one
router.get('/view/:id', requireLogin, addmemController.viewOne);

// DELETE: Delete record
router.get('/delete/:id', requireLogin , addmemController.deleteAddmem);

module.exports = router;
