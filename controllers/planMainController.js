const planModel = require('../models/planMainModel');
const thaiDate = require('../utils/thaiDate');

exports.listPage = async (req, res) => {
  try {
    const plans = await planModel.getAll();
    res.render('plan/index', { plans, title: 'แผนงานหลัก', thaiDate });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading plans');
  }
};

exports.newPage = (req, res) => {
  const ma_saveby = req.session?.user?.username || 'system';
  res.render('plan/new', { title: 'เพิ่มแผนงานหลัก', ma_saveby });
};

exports.create = async (req, res) => {
  try {
    const payload = {
      ma_code: req.body.ma_code || '',
      ma_subject: req.body.ma_subject || '',
      ma_detail: req.body.ma_detail || '',
      ma_saveby: req.session?.user?.username || req.body.ma_saveby || 'system',
      ma_savedate: req.body.ma_savedate || new Date().toISOString().slice(0,10)
    };
    await planModel.create(payload);
    res.redirect('/planMain'); // redirect to list page
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating plan');
  }
};

// small JSON API endpoints (optional)
exports.apiList = async (req, res) => {
  try {
    const plans = await planModel.getAll();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.apiDelete = async (req, res) => {
  try {
    await planModel.delete(req.params.id);
    res.redirect('/planMain'); // redirect to list page
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
