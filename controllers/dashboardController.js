const file = require('../models/homeModel');
const gitgumModel = require('../models/gitgumModel');

exports.index = async (req, res) => {
  const user = req.session.user;
  const lastGitgums = await gitgumModel.getLast(5);
  res.render('dashboard', { title: 'แดชบอร์ด', user, lastGitgums });
};

  exports.report = (req, res) => {
    // ดึงรายงานจาก DB ได้เลย
    res.send('รายงาน coming soon...');
  };
