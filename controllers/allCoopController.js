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
// List by group (optional group param)
exports.byGroup = async (req, res) => {
  const { group } = req.params;
  try {
    const groups = await coopProfileModel.getGroups();
    let coops = [];
    if (group) {
      coops = await coopProfileModel.getCoopsByGroup(group);
    }
    res.render('allCoop/group', { groups, currentGroup: group || null, coops });
  } catch (e) {
    console.error('byGroup error', e);
    res.status(500).render('error_page', { message: 'โหลดกลุ่มไม่สำเร็จ' });
  }
};
