const file = require('../models/homeModel');
exports.index = (req, res) => {
    const user = req.session.user;
    res.render('dashboard', { title: 'แดชบอร์ด', user });
  };
  
  exports.report = (req, res) => {
    // ดึงรายงานจาก DB ได้เลย
    res.send('รายงาน coming soon...');
  };
  