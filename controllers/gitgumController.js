const gitgumModel = require('../models/gitgumModel');

// แสดงรายการ
exports.list = async (req, res) => {
  const data = await gitgumModel.findAll();
  res.render('gitgum_list', { title: 'รายการกิจกรรม', data });
};

// แสดงฟอร์มเพิ่ม
exports.showAddForm = (req, res) => {
  res.render('gitgum_form', { title: 'เพิ่มกิจกรรม' });
};

// บันทึกข้อมูล
exports.saveGitgum = async (req, res) => {
  await gitgumModel.insert(req.body);
  res.redirect('/gitgum/list');
};

// แสดงฟอร์มแก้ไข
exports.showEditForm = async (req, res) => {
  const record = await gitgumModel.findById(req.params.id);
  res.render('gitgum_edit', { title: 'แก้ไขกิจกรรม', record });
};

// อัปเดต
exports.updateGitgum = async (req, res) => {
  await gitgumModel.update(req.params.id, req.body);
  res.redirect('/gitgum/list');
};

// ลบ
exports.deleteGitgum = async (req, res) => {
  await gitgumModel.delete(req.params.id);
  res.redirect('/gitgum/list');
};
