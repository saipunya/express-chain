const PlanKpi = require('../models/planKpi');
const PlanProject = require('../models/planProject');

// List all KPIs (optionally filter by project code ?pro_code=...)
exports.index = async (req, res) => {
  const { pro_code } = req.query;
  let kpis;

  if (pro_code) {
    kpis = await PlanKpi.findByProjectCode(pro_code);
  } else {
    kpis = await PlanKpi.findAll();
  }

  res.render('planKpi/index', { kpis, pro_code });
};

// Show create form
exports.create = async (req, res) => {
  const projects = await PlanProject.findAll();
  const pro_code = req.query.pro_code || '';
  res.render('planKpi/create', { projects, pro_code });
};

// Store new KPI
exports.store = async (req, res) => {
  const payload = {
    kp_number: parseInt(req.body.kp_number || '0', 10),
    kp_subject: req.body.kp_subject || '',
    kp_plan: parseInt(req.body.kp_plan || '0', 10),
    kp_action: parseInt(req.body.kp_action || '0', 10),
    kp_unit: req.body.kp_unit || '',
    kp_procode: req.body.kp_procode || '',
    kp_saveby: req.session?.user?.username || req.body.kp_saveby || 'system',
    kp_savedate: req.body.kp_savedate || new Date().toISOString().slice(0, 10)
  };

  await PlanKpi.create(payload);

  const redirectCode = payload.kp_procode ? `?pro_code=${encodeURIComponent(payload.kp_procode)}` : '';
  res.redirect('/plankpi' + redirectCode);
};

// Show edit form
exports.edit = async (req, res) => {
  const kpi = await PlanKpi.findByPk(req.params.id);
  const projects = await PlanProject.findAll();
  res.render('planKpi/edit', { kpi, projects });
};

// Update KPI
exports.update = async (req, res) => {
  const existing = await PlanKpi.findByPk(req.params.id);

  const payload = {
    kp_number: parseInt(req.body.kp_number || String(existing.kp_number || 0), 10),
    kp_subject: req.body.kp_subject || existing.kp_subject || '',
    kp_plan: parseInt(req.body.kp_plan || String(existing.kp_plan || 0), 10),
    kp_action: parseInt(req.body.kp_action || String(existing.kp_action || 0), 10),
    kp_unit: req.body.kp_unit || existing.kp_unit || '',
    kp_procode: req.body.kp_procode || existing.kp_procode || '',
    kp_saveby: req.session?.user?.username || existing.kp_saveby || 'system',
    kp_savedate: req.body.kp_savedate || existing.kp_savedate
  };

  await PlanKpi.update(req.params.id, payload);

  const redirectCode = payload.kp_procode ? `?pro_code=${encodeURIComponent(payload.kp_procode)}` : '';
  res.redirect('/plankpi' + redirectCode);
};

// Delete KPI
exports.destroy = async (req, res) => {
  const existing = await PlanKpi.findByPk(req.params.id);
  await PlanKpi.destroy(req.params.id);
  const redirectCode = existing?.kp_procode ? `?pro_code=${encodeURIComponent(existing.kp_procode)}` : '';
  res.redirect('/plankpi' + redirectCode);
};
