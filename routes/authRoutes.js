const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const onlineModel = require('../models/onlineModel');

router.get('/register', (req, res) => res.render('register'));
router.post('/register', authController.register);

router.get('/login', (req, res) => res.render('login'));
router.post('/login', authController.login);
router.get('/logout', async (req, res) => {
  try {
    // ลบข้อมูลออนไลน์ก่อน destroy session
    if (req.session.user) {
      await onlineModel.removeUserOnlineById(req.session.user.id);
    }
    
    req.session.destroy(err => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).send('<lemmaข้อ<lemmaพลาดขณะออกจากระบบ');
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('Error removing online user:', error);
    res.redirect('/');
  }
});

module.exports = router;
