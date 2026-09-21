const locationModel = require('../models/cooperativeLocationModel');
const locationService = require('../services/cooperativeLocationService');

function createController(store = locationModel) {
  const common = {
    title: 'จัดการพิกัดสหกรณ์',
    base: '/cooperative-locations',
    locationService
  };

  async function formData(values = {}, errors = {}, item = null) {
    return { ...common, institutions: await store.listInstitutions(), values, errors, item };
  }

  return {
    index: async (req, res) => {
      const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
      const items = await store.list(search);
      const counts = items.reduce((summary, item) => {
        summary.total += 1;
        if (Number(item.is_verified) === 1) summary.verified += 1;
        if (Number(item.is_public) === 1 && Number(item.is_verified) === 1) summary.public += 1;
        return summary;
      }, { total: 0, verified: 0, public: 0 });
      res.render('cooperativeLocations/index', { ...common, items, counts, search, saved: req.query.saved === '1' });
    },

    createForm: async (req, res) => {
      res.render('cooperativeLocations/form', await formData({ is_verified: false, is_public: false }, {}, null));
    },

    create: async (req, res) => {
      const { values, errors } = locationService.normalize(req.body);
      const institutions = await store.listInstitutions();
      if (!institutions.some((item) => String(item.c_code) === values.c_code)) errors.c_code = 'ไม่พบสถาบันที่เลือกในทะเบียนดำเนินการ';
      if (!errors.c_code && await store.getByCode(values.c_code)) errors.c_code = 'สถาบันนี้มีข้อมูลพิกัดแล้ว กรุณาแก้ไขรายการเดิม';
      if (Object.keys(errors).length) return res.status(422).render('cooperativeLocations/form', { ...common, institutions, values, errors, item: null });
      const updatedBy = req.session.user.fullname || req.session.user.m_name || req.session.user.username || '';
      try {
        await store.create(values, updatedBy);
      } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
          errors.c_code = 'สถาบันนี้มีข้อมูลพิกัดแล้ว กรุณาแก้ไขรายการเดิม';
          return res.status(422).render('cooperativeLocations/form', { ...common, institutions, values, errors, item: null });
        }
        throw error;
      }
      return res.redirect(303, `${common.base}?saved=1`);
    },

    editForm: async (req, res) => {
      const item = await store.getById(req.params.id);
      if (!item) return res.status(404).render('error_page', { message: 'ไม่พบข้อมูลพิกัดที่ต้องการแก้ไข' });
      const values = {
        ...item,
        is_verified: Number(item.is_verified) === 1,
        is_public: Number(item.is_public) === 1
      };
      return res.render('cooperativeLocations/form', await formData(values, {}, item));
    },

    update: async (req, res) => {
      const item = await store.getById(req.params.id);
      if (!item) return res.status(404).render('error_page', { message: 'ไม่พบข้อมูลพิกัดที่ต้องการแก้ไข' });
      const { values, errors } = locationService.normalize(req.body);
      const institutions = await store.listInstitutions();
      if (!institutions.some((institution) => String(institution.c_code) === values.c_code)) errors.c_code = 'ไม่พบสถาบันที่เลือกในทะเบียนดำเนินการ';
      const duplicate = !errors.c_code ? await store.getByCode(values.c_code) : null;
      if (duplicate && String(duplicate.id) !== String(item.id)) errors.c_code = 'สถาบันนี้มีข้อมูลพิกัดแล้ว กรุณาแก้ไขรายการเดิม';
      if (Object.keys(errors).length) return res.status(422).render('cooperativeLocations/form', { ...common, institutions, values, errors, item });
      const updatedBy = req.session.user.fullname || req.session.user.m_name || req.session.user.username || '';
      try {
        await store.update(item.id, values, updatedBy);
      } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
          errors.c_code = 'สถาบันนี้มีข้อมูลพิกัดแล้ว กรุณาแก้ไขรายการเดิม';
          return res.status(422).render('cooperativeLocations/form', { ...common, institutions, values, errors, item });
        }
        throw error;
      }
      return res.redirect(303, `${common.base}?saved=1`);
    }
  };
}

module.exports = { createController };
