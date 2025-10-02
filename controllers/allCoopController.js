const coopProfileModel = require('../models/coopProfileModel');
// Render profile by c_code
exports.profile = async (req, res) => {
  const { c_code } = req.params;
  try {
    const data = await coopProfileModel.getProfileByCode(c_code);
    if (!data.coop) {
      return res.status(404).render('error_page', { message: 'ไม่พบสหกรณ์รหัสนี้' });
    }
    res.render('allCoop/profile', { data, pageTitle: `โปรไฟล์: ${data.coop.c_name}` });
  } catch (e) {
    console.error('profile error', e);
    res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' });
  }
};
// List by group (optional group param) + search + pagination
exports.byGroup = async (req, res) => {
  const { group } = req.params;
  const q = (req.query.q || '').trim();
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '25', 10), 5), 200); // clamp 5-200
  try {
    const groups = await coopProfileModel.getGroups();
    const { rows, total } = await coopProfileModel.searchCoopsPaged({ group: group || null, q: q || null, page, pageSize });
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    res.render('allCoop/group', {
      groups,
      currentGroup: group || null,
      coops: rows,
      search: q,
      page,
      pageSize,
      total,
      totalPages
    });
  } catch (e) {
    console.error('byGroup error', e);
    res.status(500).render('error_page', { message: 'โหลดกลุ่มไม่สำเร็จ' });
  }
};
