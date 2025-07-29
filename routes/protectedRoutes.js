// routes/protectedRoutes.js
const express = require('express');
const router = express.Router();

const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

router.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard'); // เข้าถึงได้ทุกผู้ใช้ที่ login แล้ว
});

router.get('/admin', requireLogin, requireLevel('admin'), (req, res) => {
  res.send('หน้านี้สำหรับแอดมินเท่านั้น');
});

module.exports = router;

