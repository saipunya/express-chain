const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gitgumController');

router.get('/gitgum/list', ctrl.list);
router.get('/gitgum/add', ctrl.showAddForm);
router.post('/gitgum/add', ctrl.saveGitgum);
router.get('/gitgum/edit/:id', ctrl.showEditForm);
router.post('/gitgum/edit/:id', ctrl.updateGitgum);
router.get('/gitgum/delete/:id', ctrl.deleteGitgum);

module.exports = router;
