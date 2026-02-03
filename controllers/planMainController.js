const planModel = require('../models/planMainModel');
const thaiDate = require('../utils/thaiDate');

const formatDateForInput = (value) => {
  if (!value) return '';
  const dateInstance = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateInstance.getTime())) return '';
  const adjusted = new Date(dateInstance.getTime() - dateInstance.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
};

exports.listPage = async (req, res) => {
  try {
    const plans = await planModel.getAll();
    res.render('plan/index', { plans, title: 'แผนงานหลัก', thaiDate });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading plans');
  }
};

exports.update = async (req, res) => {
  try {
    const payload = {
      ma_code: req.body.ma_code || '',
      ma_subject: req.body.ma_subject || '',
      ma_detail: req.body.ma_detail || '',
      ma_saveby: req.session?.user?.username || req.body.ma_saveby || 'system',
      ma_savedate: req.body.ma_savedate || new Date().toISOString().slice(0,10)
    };
    await planModel.update(req.params.id, payload);
    res.redirect('/planmain');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating plan');
  }
};

exports.newPage = (req, res) => {
  const ma_saveby = req.session?.user?.username || 'system';
  res.render('plan/new', { title: 'เพิ่มแผนงานหลัก', ma_saveby });
};

exports.editPage = async (req, res) => {
  try {
    const plan = await planModel.getById(req.params.id);
    if (!plan) {
      return res.status(404).send('ไม่พบแผนงานหลัก');
    }
    const savedDateValue = formatDateForInput(plan.ma_savedate);
    res.render('plan/edit', { title: 'แก้ไขแผนงานหลัก', plan, savedDateValue });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading plan');
  }
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
    res.redirect('/planmain'); // redirect to list page
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
    res.redirect('/planmain'); // redirect to list page
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
