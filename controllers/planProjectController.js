const projectModel = require('../models/planProjectModel');
const planMainModel = require('../models/planMainModel');
const planActivityModel = require('../models/planActivity');
const thaiDate = require('../utils/thaiDate');
const userModel = require('../models/userModel');

const ACTIVITY_STATUS = {
  2: { label: 'ดำเนินการเรียบร้อย', badge: 'success', icon: 'check-circle' },
  1: { label: 'อยู่ระหว่างดำเนินการ', badge: 'warning text-dark', icon: 'hourglass-split' },
  0: { label: 'ยังไม่ดำเนินการ', badge: 'secondary', icon: 'clock' }
};

exports.listPage = async (req, res) => {
  const responIdRaw = req.query.pro_respon_id;
  const responIdParsed = Number.parseInt(String(responIdRaw ?? ''), 10);
  const selectedResponId = Number.isFinite(responIdParsed) ? responIdParsed : '';

  const [projects, users] = await Promise.all([
    projectModel.getAll(selectedResponId ? { pro_respon_id: selectedResponId } : undefined),
    userModel.findActiveUsers()
  ]);

  res.render('plan_project/index', {
    projects,
    users,
    selectedResponId,
    title: 'โครงการ',
    thaiDate
  });
};

exports.newPage = async (req, res) => {
  const plans = await planMainModel.getAll();
  const pro_saveby = req.session?.user?.username || 'system';
  const users = await userModel.findActiveUsers();
  res.render('plan_project/new', { title: 'เพิ่มโครงการ', plans, pro_saveby, users });
};

exports.create = async (req, res) => {
  try {
    const responIdRaw = req.body.pro_respon_id;
    const responId = Number.parseInt(String(responIdRaw ?? ''), 10);
    if (!Number.isFinite(responId)) {
      return res.status(400).send('กรุณาเลือกผู้รับผิดชอบจากรายชื่อในระบบ');
    }

    const responUser = await userModel.findActiveUserById(responId);
    if (!responUser) {
      return res.status(400).send('ไม่พบผู้รับผิดชอบในระบบ หรือผู้ใช้งานถูกปิดใช้งาน');
    }

    const payload = {
      pro_code: req.body.pro_code || '',
      pro_subject: req.body.pro_subject || '',
      pro_target: req.body.pro_target || '',
      pro_budget: req.body.pro_budget || 0,
      // Auto-set group from responsible user's member3.m_class
      pro_group: responUser.m_class || '',
      pro_respon: responUser.m_name || '',
      pro_respon_id: responUser.m_id,
      pro_saveby: req.session?.user?.username || req.body.pro_saveby || 'system',
      pro_savedate: req.body.pro_savedate || new Date().toISOString().slice(0,10),
      pro_macode: req.body.pro_macode || '',
      pro_status: parseInt(req.body.pro_status ?? '0', 10)
    };
    await projectModel.create(payload);
    res.redirect('/planproject');
  } catch (err) {
    res.status(500).send('Error creating project');
  }
};

exports.editPage = async (req, res) => {
  const project = await projectModel.getById(req.params.id);
  const plans = await planMainModel.getAll();
  const users = await userModel.findActiveUsers();
  res.render('plan_project/edit', { title: 'แก้ไขโครงการ', project, plans, users });
};

exports.update = async (req, res) => {
  try {
    const responIdRaw = req.body.pro_respon_id;
    const responId = Number.parseInt(String(responIdRaw ?? ''), 10);
    if (!Number.isFinite(responId)) {
      return res.status(400).send('กรุณาเลือกผู้รับผิดชอบจากรายชื่อในระบบ');
    }

    const responUser = await userModel.findActiveUserById(responId);
    if (!responUser) {
      return res.status(400).send('ไม่พบผู้รับผิดชอบในระบบ หรือผู้ใช้งานถูกปิดใช้งาน');
    }

    const payload = {
      pro_code: req.body.pro_code || '',
      pro_subject: req.body.pro_subject || '',
      pro_target: req.body.pro_target || '',
      pro_budget: req.body.pro_budget || 0,
      // Auto-set group from responsible user's member3.m_class
      pro_group: responUser.m_class || '',
      pro_respon: responUser.m_name || '',
      pro_respon_id: responUser.m_id,
      pro_saveby: req.session?.user?.username || req.body.pro_saveby || 'system',
      pro_savedate: req.body.pro_savedate || new Date().toISOString().slice(0,10),
      pro_macode: req.body.pro_macode || '',
      pro_status: parseInt(req.body.pro_status || '0', 10)
    };
    await projectModel.update(req.params.id, payload);
    res.redirect('/planproject');
  } catch (err) {
    res.status(500).send('Error updating project');
  }
};

exports.delete = async (req, res) => {
  try {
    await projectModel.delete(req.params.id);
    res.redirect('/planproject');
  } catch (err) {
    res.status(500).send('Error deleting project');
  }
};

exports.activitiesOverviewPage = async (req, res) => {
  try {
    const [projects, activities] = await Promise.all([
      projectModel.getAll(),
      planActivityModel.findAll()
    ]);

    const groupedActivities = activities.reduce((acc, activity) => {
      const key = activity.ac_procode || 'UNASSIGNED';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(activity);
      return acc;
    }, {});

    Object.values(groupedActivities).forEach((list) => {
      list.sort((a, b) => Number(a.ac_number || 0) - Number(b.ac_number || 0));
    });

    const projectsWithActivities = projects
      .map((project) => ({
        ...project,
        activities: groupedActivities[project.pro_code] || []
      }))
      .sort((a, b) => {
        if (!a.pro_code || !b.pro_code) return 0;
        return a.pro_code.localeCompare(b.pro_code);
      });

    const stats = {
      totalProjects: projects.length,
      totalActivities: activities.length
    };

    res.render('plan_project/activities-overview', {
      title: 'โครงการและกิจกรรมทั้งหมด',
      projects: projectsWithActivities,
      stats,
      activityStatuses: ACTIVITY_STATUS,
      thaiDate
    });
  } catch (error) {
    console.error('Error loading project activity overview:', error);
    res.status(500).send('ไม่สามารถโหลดข้อมูลโครงการและกิจกรรมได้');
  }
};
