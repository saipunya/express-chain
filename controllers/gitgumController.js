const gitgumModel = require('../models/gitgumModel');

// แสดงรายการ (รองรับ pagination)
exports.list = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);
  const offset = (page - 1) * pageSize;

  const [total, data] = await Promise.all([
    gitgumModel.countAll(),
    gitgumModel.findPage(pageSize, offset)
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  res.render('gitgum_list', {
    title: 'รายการกิจกรรม',
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages
    }
  });
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

// แสดงรายละเอียด
exports.viewOne = async (req, res) => {
  const record = await gitgumModel.findById(req.params.id);
  if (!record) return res.status(404).send('ไม่พบข้อมูล');
  res.render('gitgum_view', { title: 'รายละเอียดกิจกรรม', record });
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
