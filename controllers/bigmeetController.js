const Bigmeet = require('../models/bigmeetModel');

const requiredFields = ['big_code', 'big_endyear', 'big_type', 'big_date', 'big_saveby', 'big_savedate'];

function validateCreate(body) {
  const missing = requiredFields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return { valid: missing.length === 0, missing };
}

module.exports = {
  async list(req, res) {
    try {
      const rows = await Bigmeet.findAll();
      res.render('bigmeet/list', { items: rows });
    } catch (err) {
      console.error('bigmeet:list', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  // Render form page
  async createForm(req, res) {
    try {
      const [groups, coops] = await Promise.all([
        Bigmeet.allcoopGroups(),
        Bigmeet.allcoop(),
      ]);
      res.render('bigmeet/form', { item: null, errors: null, groups, coops });
    } catch (err) {
      console.error('bigmeet:createForm', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  // Render edit form page
  async editForm(req, res) {
    try {
      const [item, groups, coops] = await Promise.all([
        Bigmeet.findById(req.params.id),
        Bigmeet.allcoopGroups(),
        Bigmeet.allcoop(),
      ]);
      if (!item) return res.status(404).render('error_page', { message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
      res.render('bigmeet/form', { item, errors: null, groups, coops });
    } catch (err) {
      console.error('bigmeet:editForm', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async get(req, res) {
    try {
      const row = await Bigmeet.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) {
      console.error('bigmeet:get', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      const { valid, missing } = validateCreate(req.body || {});
      if (!valid) {
        const [groups, coops] = await Promise.all([
          Bigmeet.allcoopGroups(),
          Bigmeet.allcoop(),
        ]);
        return res.status(400).render('bigmeet/form', { item: req.body, errors: missing, groups, coops });
      }
      await Bigmeet.create(req.body);
      // After creating via form, redirect to list
      return res.redirect('/bigmeet');
    } catch (err) {
      console.error('bigmeet:create', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async update(req, res) {
    try {
      const exists = await Bigmeet.findById(req.params.id);
      if (!exists) return res.status(404).render('error_page', { message: 'ไม่พบข้อมูล' });

      const { valid, missing } = validateCreate(req.body || {});
      if (!valid) {
        const [groups, coops] = await Promise.all([
          Bigmeet.allcoopGroups(),
          Bigmeet.allcoop(),
        ]);
        return res.status(400).render('bigmeet/form', { item: { ...req.body, big_id: req.params.id }, errors: missing, groups, coops });
      }

      await Bigmeet.update(req.params.id, req.body || {});
      return res.redirect('/bigmeet');
    } catch (err) {
      console.error('bigmeet:update', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async remove(req, res) {
    try {
      const ok = await Bigmeet.remove(req.params.id);
      if (!ok) return res.status(404).render('error_page', { message: 'Not found' });
      res.redirect('/bigmeet');
    } catch (err) {
      console.error('bigmeet:remove', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },
};


