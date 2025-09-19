const PlanActivity = require('../models/planActivity');
const PlanProject = require('../models/planProject');

// List all activities
exports.index = async (req, res) => {
  const activities = await PlanActivity.findAll();
  res.render('planActivity/index', { activities });
};

// Show create form
exports.create = async (req, res) => {
  const projects = await PlanProject.findAll();
  res.render('planActivity/create', { projects });
};

// Store new activity
exports.store = async (req, res) => {
  await PlanActivity.create(req.body);
  res.redirect('/planActivity');
};

// Show edit form
exports.edit = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  const projects = await PlanProject.findAll();
  res.render('planActivity/edit', { activity, projects });
};

// Update activity
exports.update = async (req, res) => {
  await PlanActivity.update(req.params.id, req.body);
  res.redirect('/planActivity');
};

// Delete activity
exports.destroy = async (req, res) => {
  await PlanActivity.destroy(req.params.id);
  res.redirect('/planActivity');
};

// Show detail
exports.show = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  res.render('planActivity/show', { activity });
};
