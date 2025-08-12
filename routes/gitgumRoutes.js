const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gitgumController');

// Base path is /gitgum from routes/index.js
router.get('/list', ctrl.list);
router.get('/add', ctrl.showAddForm);
router.post('/add', ctrl.saveGitgum);
router.get('/view/:id', ctrl.viewOne);
router.get('/edit/:id', ctrl.showEditForm);
router.post('/edit/:id', ctrl.updateGitgum);
router.get('/delete/:id', ctrl.deleteGitgum);

module.exports = router;
