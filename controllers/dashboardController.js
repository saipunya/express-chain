const file = require('../models/homeModel');
const gitgumModel = require('../models/gitgumModel');
const activityModel = require('../models/activityModel'); // เพิ่มบรรทัดนี้

exports.index = async (req, res) => {
  const user = req.session.user;
  if (['coop', 'group'].includes(String(user?.group || '').trim())) {
    return res.redirect('/dashboard2');
  }
  const lastGitgums = await gitgumModel.getLast(5);
  const activity = await activityModel.getLastActivities(10); // ดึง 10 กิจกรรมล่าสุด
  res.render('dashboard', { title: 'แดชบอร์ด', user, lastGitgums, activity });
};

exports.institutionIndex = async (req, res) => {
  const user = req.session.user;
  if (!['coop', 'group'].includes(String(user?.group || '').trim())) {
    return res.redirect('/dashboard');
  }

  res.render('dashboard2', {
    title: 'แดชบอร์ดสมาชิกสถาบัน',
    user
  });
};

exports.report = (req, res) => {
  // ดึงรายงานจาก DB ได้เลย
  res.send('รายงาน coming soon...');
};
