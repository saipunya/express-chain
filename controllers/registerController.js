const bcrypt = require('bcryptjs');
const Member3 = require('../models/registerModel');

const GROUPS = ['cpd', 'coop', 'group', ''];
const TYPES = ['ข้าราชการ','ลูกจ้างประจำ','พนักงานราชการ','จ้างเหมาบริการ','สหกรณ์(สถาบัน)','กลุ่มเกษตรกร(สถาบัน)','สมาชิกสถาบัน'];
const CLASSES = ['head','admin','kts','kbs','kps','kjs','pbt','group1','group2','group3','group4','group5','h_kss1','h_kss2','h_kss3','h_kss4','h_kss5','hiring','c','g','m'];
const STATUSES = ['active','wait','ban',''];

exports.addForm = async (req, res) => {
  res.render('member3/create', { groups: GROUPS, types: TYPES, classes: CLASSES, statuses: STATUSES, error: null });
};

exports.create = async (req, res) => {
  try {
    const {
      m_user, m_pass, m_group, m_name, m_position, m_head, m_usersystem,
      m_type, m_org, m_class, m_pic, m_status, m_img
    } = req.body;

    if (!m_user || !m_pass || !m_group || !m_name || !m_position || !m_usersystem || !m_type || !m_org || !m_class) {
      return res.status(400).send('ข้อมูลไม่ครบ');
    }
    if (!GROUPS.includes(m_group)) return res.status(400).send('m_group ไม่ถูกต้อง');
    if (!TYPES.includes(m_type)) return res.status(400).send('m_type ไม่ถูกต้อง');
    if (!CLASSES.includes(m_class)) return res.status(400).send('m_class ไม่ถูกต้อง');
    if (m_status && !STATUSES.includes(m_status)) return res.status(400).send('m_status ไม่ถูกต้อง');

    const existed = await Member3.findByUser(m_user);
    if (existed) return res.status(409).send('m_user นี้ถูกใช้แล้ว');

    const hash = await bcrypt.hash(m_pass, 10);
    const insertId = await Member3.create({
      m_user,
      m_pass: hash,
      m_group,
      m_name,
      m_position,
      m_head: m_head || '',
      m_usersystem,
      m_type,
      m_org,
      m_class,
      m_pic: m_pic || '',
      m_status: m_status || 'wait',
      m_img: m_img || ''
    });

    res.redirect('/member3'); // ปรับเส้นทางตามหน้าที่ต้องการกลับไป
  } catch (err) {
    console.error(err);
    res.status(500).send('บันทึกไม่สำเร็จ');
  }
};