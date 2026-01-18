const projectModel = require('../models/planProjectModel');
const planMainModel = require('../models/planMainModel');
const thaiDate = require('../utils/thaiDate');

exports.listPage = async (req, res) => {
  const projects = await projectModel.getAll();
  res.render('plan_project/index', { projects, title: 'โครงการ', thaiDate });
};

exports.newPage = async (req, res) => {
  const plans = await planMainModel.getAll();
  const pro_saveby = req.session?.user?.username || 'system';
  res.render('plan_project/new', { title: 'เพิ่มโครงการ', plans, pro_saveby });
};

exports.create = async (req, res) => {
  try {
    const payload = {
      pro_code: req.body.pro_code || '',
      pro_subject: req.body.pro_subject || '',
      pro_target: req.body.pro_target || '',
      pro_budget: req.body.pro_budget || 0,
      pro_group: req.body.pro_group || '',
      pro_respon: req.body.pro_respon || '',
      pro_saveby: req.session?.user?.username || req.body.pro_saveby || 'system',
      pro_savedate: req.body.pro_savedate || new Date().toISOString().slice(0,10),
      pro_macode: req.body.pro_macode || '',
      pro_status: parseInt(req.body.pro_status ?? '0', 10)
    };
    await projectModel.create(payload);
    res.redirect('/planproject');
  } catch (err) {
    res.status(500).send('Error creating project');
  }
};

exports.editPage = async (req, res) => {
  const project = await projectModel.getById(req.params.id);
  const plans = await planMainModel.getAll();
  res.render('plan_project/edit', { title: 'แก้ไขโครงการ', project, plans });
};

exports.update = async (req, res) => {
  try {
    const payload = {
      pro_code: req.body.pro_code || '',
      pro_subject: req.body.pro_subject || '',
      pro_target: req.body.pro_target || '',
      pro_budget: req.body.pro_budget || 0,
      pro_group: req.body.pro_group || '',
      pro_respon: req.body.pro_respon || '',
      pro_saveby: req.session?.user?.username || req.body.pro_saveby || 'system',
      pro_savedate: req.body.pro_savedate || new Date().toISOString().slice(0,10),
      pro_macode: req.body.pro_macode || '',
      pro_status: parseInt(req.body.pro_status || '0', 10)
    };
    await projectModel.update(req.params.id, payload);
    res.redirect('/planproject');
  } catch (err) {
    res.status(500).send('Error updating project');
  }
};

exports.delete = async (req, res) => {
  try {
    await projectModel.delete(req.params.id);
    res.redirect('/planproject');
  } catch (err) {
    res.status(500).send('Error deleting project');
  }
};
