const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', (req, res) => res.render('register'));
router.post('/register', authController.register);

router.get('/login', (req, res) => res.render('login'));
router.post('/login', authController.login);
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('เกิดข้อผิดพลาดขณะออกจากระบบ');
    }
    res.redirect('/'); // กลับไปหน้าแรกหลังออกจากระบบ
  });
});

module.exports = router;
