const router = require('express').Router();

// Public calculator: no account or saved financial data is required.
router.get('/', (_req, res) => {
  res.render('loanLimit/index', { title: 'การคำนวณวงเงินกู้ยืมหรือค้ำประกัน' });
});

module.exports = router;
