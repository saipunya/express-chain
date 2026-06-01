const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const onlineModel = require('../models/onlineModel');
const { isInstitutionUser, noCache } = require('../middlewares/authMiddleware');

function getLandingPath(user) {
  const mClass = String(user?.mClass || user?.m_class || '').trim().toLowerCase();
  return ['c', 'g'].includes(mClass) ? '/homecoop' : '/home/';
}

router.get('/register', (req, res) => res.render('register'));
router.post('/register', authController.register);

// Accept returnTo via query: /auth/login?returnTo=/some/path
router.get('/login', noCache, (req, res) => {
  const { returnTo } = req.query || {};
  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('/auth')) {
    req.session.returnTo = returnTo;
  }
  // If user already logged in, redirect immediately
  if (req.session.user) {
    const defaultLanding = getLandingPath(req.session.user);
    const redirectTo = (typeof req.session.returnTo === 'string' && req.session.returnTo.startsWith('/') && !req.session.returnTo.startsWith('/auth'))
      ? req.session.returnTo
      : defaultLanding;
    delete req.session.returnTo;
    return res.redirect(isInstitutionUser(req.session.user) ? defaultLanding : redirectTo);
  }
  const { registered } = req.query || {};
  const registeredMessage = registered ? 'สมัครสมาชิกสำเร็จ กำลังรอการอนุมัติจากผู้ดูแลระบบ' : null;
  const safeReturnTo = (typeof req.session.returnTo === 'string' && req.session.returnTo.startsWith('/') && !req.session.returnTo.startsWith('/auth'))
    ? req.session.returnTo
    : '';
  res.render('login', { registeredMessage, returnTo: safeReturnTo });
});

router.post('/login', authController.login);

router.get('/logout', noCache, async (req, res) => {
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
      res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax' });
      res.redirect('/');
    });
  } catch (error) {
    console.error('Error removing online user:', error);
    res.redirect('/');
  }
});

module.exports = router;
