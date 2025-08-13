const fs = require('fs');
const path = require('path');
const Rq2 = require('../models/rq2Model');

const rq2Controller = {
  index: async (req, res) => {
    const search = req.query.search || '';
    const items = await Rq2.getAll(search);
    res.render('rq2/index', { items, search });
  },
  createForm: async (req, res) => {
    try {
      const ActiveCoop = require('../models/activeCoopModel');
      const groups = await ActiveCoop.getGroups();
      res.render('rq2/create', { groups, coops: [] });
    } catch (e) {
      console.error('Load groups failed:', e.message || e);
      // Render page with empty groups so user can still access the form
      res.render('rq2/create', { groups: [], coops: [] });
    }
  },

  // API: list coops by group (for dynamic select)
  apiCoopsByGroup: async (req, res) => {
    try {
      const ActiveCoop = require('../models/activeCoopModel');
      const items = await ActiveCoop.getByGroup(req.query.group || '');
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: 'failed' });
    }
  },
  create: async (req, res) => {
    try {
      const rq_file = req.file ? req.file.filename : '';
      // Only select is sent: rq_name holds c_code; we fetch c_name by code
      const ActiveCoop = require('../models/activeCoopModel');
      const rq_code = req.body.rq_name; // c_code
      const coop = rq_code ? await ActiveCoop.getByCode(rq_code) : null;
      const rq_name = coop?.c_name || '';
      const data = {
        rq_code,
        rq_name,
        rq_year: req.body.rq_year,
        rq_file,
        rq_saveby: req.session.user?.fullname || 'unknown',
        rq_savedate: new Date()
      };
      // Duplicate check by (rq_code, rq_year)
      if (await Rq2.existsByCodeYear(rq_code, data.rq_year)) {
        return res.status(400).send('ข้อมูลซ้ำ: รหัสและปีนี้ถูกบันทึกแล้ว');
      }
      await Rq2.create(data);
      res.redirect('/rq2');
    } catch (e) {
      console.error('Create rq2 error:', e);
      res.status(500).send('Error creating rq2');
    }
  },
  editForm: async (req, res) => {
    const item = await Rq2.getById(req.params.id);
    const ActiveCoop = require('../models/activeCoopModel');
    const coops = await ActiveCoop.getAllSimple();
    res.render('rq2/edit', { item, coops });
  },
  update: async (req, res) => {
    try {
      const current = await Rq2.getById(req.params.id);
      let rq_file = current?.rq_file || '';
      if (req.file) {
        // remove old file
        if (rq_file) {
          const fp = path.join(__dirname, '..', 'uploads', 'rq2', rq_file);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        rq_file = req.file.filename;
      }
      const rq_code = req.body.rq_name || req.body.rq_code; // prefer select value
      const dup = await Rq2.existsByCodeYear(rq_code, req.body.rq_year, req.params.id);
      if (dup) return res.status(400).send('ข้อมูลซ้ำ: รหัสและปีนี้ถูกบันทึกแล้ว');
      await Rq2.update(req.params.id, { ...req.body, rq_code, rq_file });
      res.redirect('/rq2');
    } catch (e) {
      console.error('Update rq2 error:', e);
      res.status(500).send('Error updating rq2');
    }
  },
  delete: async (req, res) => {
    try {
      const current = await Rq2.getById(req.params.id);
      if (current?.rq_file) {
        const fp = path.join(__dirname, '..', 'uploads', 'rq2', current.rq_file);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await Rq2.delete(req.params.id);
      res.redirect('/rq2');
    } catch (e) {
      console.error('Delete rq2 error:', e);
      res.status(500).send('Error deleting rq2');
    }
  },
  download: async (req, res) => {
    try {
      const item = await Rq2.getById(req.params.id);
      if (!item || !item.rq_file) return res.status(404).send('ไม่พบไฟล์');
      const filePath = path.join(__dirname, '..', 'uploads', 'rq2', item.rq_file);
      if (!fs.existsSync(filePath)) return res.status(404).send('ไม่พบไฟล์ในระบบ');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.rq_file)}"`);
      return res.sendFile(path.resolve(filePath));
    } catch (e) {
      console.error('Download rq2 error:', e);
      res.status(500).send('Error downloading file');
    }
  }
};

module.exports = rq2Controller;

