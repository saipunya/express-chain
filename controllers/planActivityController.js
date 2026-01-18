const PlanActivity = require('../models/planActivity');
const PlanProject = require('../models/planProject');

// List all activities
exports.index = async (req, res) => {
  const activities = await PlanActivity.findAll();
  res.render('planActivity/index', { activities });
};

// Select project page (before creating activities)
exports.selectProjectPage = async (req, res) => {
  const projects = await PlanProject.findAll();
  res.render('planActivity/select-project', { projects });
};

// Show create form
exports.create = async (req, res) => {
  const projects = await PlanProject.findAll();
  const pro_code = req.query.pro_code || '';
  const ac_saveby = req.session?.user?.username || req.session?.user?.fullname || 'system';
  res.render('planActivity/create', { projects, pro_code, ac_saveby });
};

// Show bulk create form
exports.createMany = async (req, res) => {
  const projects = await PlanProject.findAll();
  const pro_code = req.query.pro_code || '';
  const ac_saveby = req.session?.user?.username || req.session?.user?.fullname || 'system';
  res.render('planActivity/create-many', { projects, pro_code, ac_saveby });
};

// Store new activity
exports.store = async (req, res) => {
  const payload = {
    ac_number: parseInt(req.body.ac_number || '0', 10),
    ac_subject: req.body.ac_subject || '',
    ac_status: parseInt(req.body.ac_status ?? '0', 10),
    ac_procode: req.body.ac_procode || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || req.body.ac_saveby || 'system',
    ac_savedate: req.body.ac_savedate || new Date().toISOString().slice(0, 10)
  };

  await PlanActivity.create(payload);
  res.redirect('/planactivity');
};

// Store many activities at once
exports.storeMany = async (req, res) => {
  let { activities } = req.body;

  if (!activities) {
    return res.status(400).send('Missing activities');
  }

  if (!Array.isArray(activities)) {
    if (activities && typeof activities === 'object') {
      activities = Object.keys(activities)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => activities[k]);
    } else {
      activities = [activities];
    }
  }

  const fallbackSaveBy = req.session?.user?.username || req.session?.user?.fullname || 'system';
  const today = new Date().toISOString().slice(0, 10);

  const items = activities
    .map((row) => ({
      ac_number: parseInt(row.ac_number || '0', 10),
      ac_subject: (row.ac_subject || '').trim(),
      ac_status: parseInt(row.ac_status ?? '0', 10),
      ac_procode: (row.ac_procode || req.body.pro_code || '').trim(),
      ac_saveby: (row.ac_saveby || req.body.ac_saveby || fallbackSaveBy).trim(),
      ac_savedate: row.ac_savedate || req.body.ac_savedate || today
    }))
    .filter((row) => row.ac_subject && row.ac_procode);

  if (items.length === 0) {
    return res.status(400).send('No valid activity rows');
  }

  if (typeof PlanActivity.createMany === 'function') {
    await PlanActivity.createMany(items);
  } else {
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      await PlanActivity.create(item);
    }
  }

  res.redirect('/planactivity');
};

// Show edit form
exports.edit = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  const projects = await PlanProject.findAll();
  res.render('planActivity/edit', { activity, projects });
};

// Update activity
exports.update = async (req, res) => {
  const existing = await PlanActivity.findByPk(req.params.id);
  const payload = {
    ac_number: parseInt(req.body.ac_number || String(existing?.ac_number || 0), 10),
    ac_subject: req.body.ac_subject || existing?.ac_subject || '',
    ac_status: parseInt(req.body.ac_status ?? String(existing?.ac_status ?? 0), 10),
    ac_procode: req.body.ac_procode || existing?.ac_procode || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || existing?.ac_saveby || 'system',
    ac_savedate: req.body.ac_savedate || existing?.ac_savedate || new Date().toISOString().slice(0, 10)
  };
  await PlanActivity.update(req.params.id, payload);
  res.redirect('/planactivity');
};

// Delete activity
exports.destroy = async (req, res) => {
  await PlanActivity.destroy(req.params.id);
  res.redirect('/planactivity');
};

// Show detail
exports.show = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  res.render('planActivity/show', { activity });
};
