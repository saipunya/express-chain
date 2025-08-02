// routes/homeRoutes.js

const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { requireLogin } = require('../middlewares/authMiddleware');

router.get('/', homeController.index);
router.get('/download/:id', homeController.downloadById);

router.get('/finance', homeController.loadFinance);
router.get('/finance/view/:id', requireLogin, homeController.downloadById);

module.exports = router;
