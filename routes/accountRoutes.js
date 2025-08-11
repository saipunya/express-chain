// routes/accountRoutes.js
const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { requireLevel } = require('../middlewares/authMiddleware');

router.get('/list', accountController.index);
router.get('/create',requireLevel('admin'), accountController.createForm);
router.post('/create',requireLevel('admin'), accountController.create);
router.get('/edit/:id',requireLevel('admin'), accountController.editForm);
router.post('/edit/:id',requireLevel('admin'), accountController.update);
router.get('/delete/:id',requireLevel('admin'), accountController.delete);

module.exports = router;
