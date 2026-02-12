const express = require('express');
const router = express.Router();
const bigmeetController = require('../controllers/bigmeetController');
const { isAuth } = require('../middlewares/authMiddleware');

// ใช้ isAuth middleware ก่อนเข้าถึง controller
router.get('/', isAuth, bigmeetController.getAll);
router.get('/new', isAuth, bigmeetController.createForm);

module.exports = router;
