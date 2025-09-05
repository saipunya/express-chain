const pool = require('../config/db'); 
const activeCoopModel = require('../models/activeCoopModel');

exports.index = async (req, res) => {
  const search = req.query.search || '';
  const group = req.query.group || 'all';
  const status = req.query.status || 'all';
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const coops = await activeCoopModel.getAll(search, group, status, limit, offset);
  const total = await activeCoopModel.countAll(search, group, status);
  const totalPages = Math.ceil(total / limit);

  res.render('activeCoop/index', { coops, search, group, status, page, totalPages });
};

exports.createForm = (req, res) => {
  res.render('activeCoop/create');
};

exports.store = async (req, res) => {
  await activeCoopModel.create(req.body);
  res.redirect('/active-coop');
};

exports.editForm = async (req, res) => {
  const coop = await activeCoopModel.getById(req.params.id);

  // ดึงรายชื่อสมาชิก member3
  const [members] = await pool.query('SELECT m_name FROM member3 ORDER BY m_name ASC');

  res.render('activeCoop/edit', { coop, members });
};

exports.update = async (req, res) => {
  await activeCoopModel.update(req.params.id, req.body);
  res.redirect('/activeCoop');
};

exports.delete = async (req, res) => {
  await activeCoopModel.remove(req.params.id);
  res.redirect('/active-coop');
};

exports.listByEndDate = async (req, res) => {
  try {
    const groups = await activeCoopModel.getAllGroupedByEndDate();
    res.render('activeCoop/list', { groups });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error loading data');
  }
};