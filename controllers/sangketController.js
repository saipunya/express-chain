const Sangket = require('../models/sangketModel');

const sangketController = {
  index: async (req, res) => {
    const search = (req.query.search || '').trim();
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '10', 10);
    const { rows, total } = await Sangket.getPaged(search, page, pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pagination = { page, pageSize, total, totalPages, hasPrev: page > 1, hasNext: page < totalPages };
    res.render('sangket/index', { items: rows, search, pagination });
  },

  createForm: (req, res) => {
    res.render('sangket/form', { item: null, error: null });
  },

  create: async (req, res) => {
    try {
      const payload = { ...req.body };
      payload.sang_saveby = req.session?.user?.fullname || 'system';
      payload.sang_savedate = req.body.sang_savedate || new Date();
      await Sangket.create(payload);
      res.redirect('/sangket');
    } catch (e) {
      console.error('Create sangket error:', e);
      res.status(500).render('sangket/form', { item: req.body, error: 'บันทึกไม่สำเร็จ' });
    }
  },

  editForm: async (req, res) => {
    const item = await Sangket.getById(req.params.id);
    if (!item) return res.status(404).send('ไม่พบข้อมูล');
    res.render('sangket/form', { item, error: null });
  },

  update: async (req, res) => {
    try {
      const payload = { ...req.body };
      payload.sang_saveby = req.session?.user?.fullname || 'system';
      payload.sang_savedate = req.body.sang_savedate || new Date();
      await Sangket.update(req.params.id, payload);
      res.redirect('/sangket');
    } catch (e) {
      console.error('Update sangket error:', e);
      res.status(500).render('sangket/form', { item: { ...req.body, sang_id: req.params.id }, error: 'แก้ไขไม่สำเร็จ' });
    }
  },

  delete: async (req, res) => {
    try {
      await Sangket.delete(req.params.id);
      res.redirect('/sangket');
    } catch (e) {
      console.error('Delete sangket error:', e);
      res.status(500).send('ลบไม่สำเร็จ');
    }
  },

  view: async (req, res) => {
    const item = await Sangket.getById(req.params.id);
    if (!item) return res.status(404).send('ไม่พบข้อมูล');
    res.render('sangket/view', { item });
  }
};

module.exports = sangketController;
