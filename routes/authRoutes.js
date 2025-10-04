const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const onlineModel = require('../models/onlineModel');

router.get('/register', (req, res) => res.render('register'));
router.post('/register', authController.register);

// Accept returnTo via query: /auth/login?returnTo=/some/path
router.get('/login', (req, res) => {
  const { returnTo } = req.query || {};
  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('/auth')) {
    req.session.returnTo = returnTo;
  }
  // If user already logged in, redirect immediately
  if (req.session.user) {
    const redirectTo = (typeof req.session.returnTo === 'string' && req.session.returnTo.startsWith('/') && !req.session.returnTo.startsWith('/auth'))
      ? req.session.returnTo
      : '/dashboard';
    delete req.session.returnTo;
    return res.redirect(redirectTo);
  }
  res.render('login');
});

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
