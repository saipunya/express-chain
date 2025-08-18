const Chamra = require('../models/chamraModel');

const chamraController = {};

// แสดงทั้งหมด
chamraController.list = async (req, res) => {
  const data = await Chamra.getAll();
  res.render('chamra/list', { data });
};

// แสดง form เพิ่ม
chamraController.addForm = (req, res) => {
  res.render('chamra/form', { chamra: null });
};

// แสดง form แก้ไข
chamraController.editForm = async (req, res) => {
  const c_code = req.params.c_code;
  const chamra = await Chamra.getByCode(c_code);
  res.render('chamra/form', { chamra });
};

// บันทึกเพิ่ม
chamraController.create = async (req, res) => {
  const { active, detail, process } = req.body;
  await Chamra.create({ active, detail, process });
  res.redirect('/chamra');
};

// บันทึกแก้ไข
chamraController.update = async (req, res) => {
  const c_code = req.params.c_code;
  const { active, detail, process } = req.body;
  await Chamra.update(c_code, { active, detail, process });
  res.redirect('/chamra');
};

// ลบ
chamraController.delete = async (req, res) => {
  const c_code = req.params.c_code;
  await Chamra.delete(c_code);
  res.redirect('/chamra');
};

module.exports = chamraController;
