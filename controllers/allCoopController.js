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
// List by group (optional group param) + search
exports.byGroup = async (req, res) => {
  const { group } = req.params;
  const q = (req.query.q || '').trim();
  try {
    const groups = await coopProfileModel.getGroups();
    // Use new unified search
    const coops = await coopProfileModel.searchCoops({ group: group || null, q: q || null });
    res.render('allCoop/group', { groups, currentGroup: group || null, coops, search: q });
  } catch (e) {
    console.error('byGroup error', e);
    res.status(500).render('error_page', { message: 'โหลดกลุ่มไม่สำเร็จ' });
  }
};
