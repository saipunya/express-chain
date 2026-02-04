const projectModel = require('../models/planProjectModel');
const planMainModel = require('../models/planMainModel');
const planActivityModel = require('../models/planActivity');
const PlanKpi = require('../models/planKpi');
const PlanKpiMonthly = require('../models/planKpiMonthly');
const thaiDate = require('../utils/thaiDate');
const userModel = require('../models/userModel');
const db = require('../config/db');

const ACTIVITY_STATUS = {
  2: { label: 'ดำเนินการเรียบร้อย', badge: 'success', icon: 'check-circle' },
  1: { label: 'อยู่ระหว่างดำเนินการ', badge: 'warning text-dark', icon: 'hourglass-split' },
  0: { label: 'ยังไม่ดำเนินการ', badge: 'secondary', icon: 'clock' }
};

const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const toThaiMonthLabel = (value) => {
  if (!value) return '';
  let isoValue = '';
  if (value instanceof Date) {
    isoValue = value.toISOString().slice(0, 10);
  } else if (typeof value === 'string') {
    isoValue = value.includes('T') ? value.split('T')[0] : value;
  } else if (value && typeof value.toISOString === 'function') {
    isoValue = value.toISOString().slice(0, 10);
  } else {
    isoValue = String(value);
  }

  const normalized = isoValue.length >= 7 ? isoValue.slice(0, 7) : isoValue;
  if (!normalized.includes('-')) {
    return normalized;
  }

  const [y, m] = normalized.split('-');
  const monthIndex = Number(m) - 1;
  const name = TH_MONTHS[monthIndex] || m;
  const thaiYear = Number.isFinite(Number(y)) ? Number(y) + 543 : y;
  return `${name} ${thaiYear}`;
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
    const currentUser = req.session?.user;
    
    // If user is not admin/pbt, filter to only their projects
    let projectFilter = undefined;
    if (currentUser && currentUser.level !== 'admin' && currentUser.level !== 'pbt') {
      projectFilter = { pro_respon_id: currentUser.id };
    }
    
    const [projects, activities] = await Promise.all([
      projectModel.getAll(projectFilter),
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

    // Count only activities from filtered projects (not all activities)
    const totalActivitiesInProjects = projectsWithActivities.reduce((sum, project) => sum + (project.activities?.length || 0), 0);

    const stats = {
      totalProjects: projects.length,
      totalActivities: totalActivitiesInProjects
    };

    // Check if current user is admin or pbt (can manage all projects)
    const canManageAll = currentUser && (currentUser.level === 'admin' || currentUser.level === 'pbt');

    res.render('plan_project/activities-overview', {
      title: 'โครงการและกิจกรรมทั้งหมด',
      projects: projectsWithActivities,
      stats,
      canManageAll,
      currentUser,
      activityStatuses: ACTIVITY_STATUS,
      thaiDate
    });
  } catch (error) {
    console.error('Error loading project activity overview:', error);
    res.status(500).send('ไม่สามารถโหลดข้อมูลโครงการและกิจกรรมได้');
  }
};

exports.summaryPage = async (req, res) => {
  try {
    const proCode = req.params.code;
    const project = await projectModel.getByCode(proCode);
    if (!project) {
      return res.status(404).render('error', { message: 'ไม่พบโครงการที่ระบุ' });
    }

    const mainPlan = project.pro_macode ? await planMainModel.getByCode(project.pro_macode) : null;

    const [activities, kpis] = await Promise.all([
      typeof planActivityModel.findWithLatestMonthly === 'function'
        ? planActivityModel.findWithLatestMonthly(proCode)
        : planActivityModel.findByProjectCode(proCode),
      PlanKpi.findByProjectCode(proCode)
    ]);

    const activityStats = activities.reduce(
      (acc, activity) => {
        const status = Number(activity.monthly_status ?? activity.ac_status ?? -1);
        if (status === 2) acc.completed += 1;
        else if (status === 1) acc.inProgress += 1;
        else if (status === 0) acc.notStarted += 1;
        else acc.pending += 1;
        return acc;
      },
      { completed: 0, inProgress: 0, notStarted: 0, pending: 0 }
    );

    let kpiMetrics = [];
    const kpiIds = kpis.map((kpi) => kpi.kp_id);
    if (kpiIds.length) {
      const totals = await PlanKpiMonthly.sumForIds(kpiIds);

      let latestRows = [];
      try {
        const placeholders = kpiIds.map(() => '?').join(',');
        const [rows] = await db.query(
          `SELECT m.*
           FROM plan_kpi_monthly m
           INNER JOIN (
             SELECT kp_id, MAX(updated_at) AS latest_update
             FROM plan_kpi_monthly
             WHERE kp_id IN (${placeholders})
             GROUP BY kp_id
           ) latest ON latest.kp_id = m.kp_id AND latest.latest_update = m.updated_at`,
          kpiIds
        );
        latestRows = rows;
      } catch (err) {
        console.error('Error fetching latest KPI rows', err);
      }

      const latestMap = latestRows.reduce((acc, row) => {
        acc[row.kp_id] = row;
        return acc;
      }, {});

      kpiMetrics = kpis.map((kpi) => {
        const cumulative = Number(totals[kpi.kp_id] ?? 0);
        const target = Number(kpi.kp_plan || 0);
        const percent = target ? (cumulative / target) * 100 : null;
        return {
          ...kpi,
          cumulative_total: cumulative,
          achievement_percent: percent,
          latest_monthly: latestMap[kpi.kp_id] || null
        };
      });
    }

    let kpiHistory = [];
    let kpiTimelineMonths = [];
    let kpiTimelineRows = [];
    if (kpiIds.length) {
      try {
        const placeholders = kpiIds.map(() => '?').join(',');
        const [rows] = await db.query(
          `SELECT kp_id, report_month, actual_value
           FROM plan_kpi_monthly
           WHERE kp_id IN (${placeholders})
           ORDER BY report_month ASC, kp_id ASC`,
          kpiIds
        );

        const normalizeMonthKey = (value) => {
          if (!value) return '';
          if (typeof value === 'string') {
            return value.slice(0, 7);
          }
          if (value instanceof Date) {
            return value.toISOString().slice(0, 7);
          }
          if (value && typeof value.toISOString === 'function') {
            return value.toISOString().slice(0, 7);
          }
          return String(value).slice(0, 7);
        };

        const monthSet = new Set();
        const monthlyValueMap = {};
        rows.forEach((row) => {
          const monthKey = normalizeMonthKey(row.report_month);
          if (!monthKey) return;
          monthSet.add(monthKey);
          const key = `${row.kp_id}_${monthKey}`;
          monthlyValueMap[key] = Number(row.actual_value || 0);
        });

        const monthsAsc = Array.from(monthSet).sort();
        kpiTimelineMonths = monthsAsc.map((month) => ({
          value: month,
          label: toThaiMonthLabel(month)
        }));
        const runningTotals = Object.fromEntries(kpiIds.map((id) => [id, 0]));
        const cumulativeMap = {};
        monthsAsc.forEach((month) => {
          kpiIds.forEach((kpiId) => {
            const key = `${kpiId}_${month}`;
            const monthlyValue = monthlyValueMap[key];
            if (monthlyValue !== undefined) {
              runningTotals[kpiId] += monthlyValue;
              cumulativeMap[key] = runningTotals[kpiId];
            } else if (runningTotals[kpiId] > 0) {
              cumulativeMap[key] = runningTotals[kpiId];
            }
          });
        });

        const monthsDesc = [...monthsAsc].sort((a, b) => b.localeCompare(a));
        kpiHistory = monthsDesc
          .map((month) => {
            const entries = kpis.map((kpi) => {
              const key = `${kpi.kp_id}_${month}`;
              return {
                kpi_id: kpi.kp_id,
                subject: kpi.kp_subject,
                unit: kpi.kp_unit,
                target: Number(kpi.kp_plan || 0),
                monthly_value: monthlyValueMap[key],
                cumulative_value: cumulativeMap[key]
              };
            });

            const hasData = entries.some(
              (entry) => entry.monthly_value !== undefined || entry.cumulative_value !== undefined
            );
            if (!hasData) {
              return null;
            }

            const monthTotal = entries.reduce((sum, entry) => sum + Number(entry.monthly_value || 0), 0);
            const cumulativeTotal = entries.reduce((sum, entry) => sum + Number(entry.cumulative_value || 0), 0);
            const targetTotal = entries.reduce((sum, entry) => sum + Number(entry.target || 0), 0);
            const percent = targetTotal ? (cumulativeTotal / targetTotal) * 100 : null;

            return {
              month,
              month_label: toThaiMonthLabel(month),
              entries,
              monthTotal,
              cumulativeTotal,
              targetTotal,
              percent
            };
          })
          .filter(Boolean);

        kpiTimelineRows = kpis
          .map((kpi) => {
            const monthValues = monthsAsc.map((month) => {
              const key = `${kpi.kp_id}_${month}`;
              return {
                month,
                monthly_value: monthlyValueMap[key],
                cumulative_value: cumulativeMap[key]
              };
            });
            const hasData = monthValues.some((item) => item.monthly_value !== undefined || item.cumulative_value !== undefined);
            if (!hasData) return null;
            // Get latest cumulative value from the last month
            let latestCumulative = 0;
            for (let i = monthsAsc.length - 1; i >= 0; i--) {
              const key = `${kpi.kp_id}_${monthsAsc[i]}`;
              if (cumulativeMap[key] !== undefined) {
                latestCumulative = cumulativeMap[key];
                break;
              }
            }
            return {
              kpi_id: kpi.kp_id,
              subject: kpi.kp_subject,
              unit: kpi.kp_unit,
              target: Number(kpi.kp_plan || 0),
              latestCumulative,
              monthValues
            };
          })
          .filter(Boolean);
      } catch (error) {
        console.error('Error fetching KPI history', error);
        kpiHistory = [];
        kpiTimelineMonths = [];
        kpiTimelineRows = [];
      }
    }

    const summary = {
      activities: activityStats,
      completionPercent:
        activities.length > 0 ? Math.round((activityStats.completed / activities.length) * 100) : 0,
      kpiCount: kpiMetrics.length,
      kpiAchieved: kpiMetrics.filter((kpi) => (kpi.achievement_percent ?? 0) >= 100).length
    };

    // Check if current user can edit (owner or admin)
    const currentUser = req.session?.user;
    const canEdit = currentUser && (project.pro_respon_id === currentUser.id || currentUser.level === 'admin');

    res.render('plan_project/summary', {
      title: `สรุปโครงการ ${project.pro_subject}`,
      project,
      mainPlan,
      activities,
      kpiMetrics,
      kpiHistory,
      kpiTimelineMonths,
      kpiTimelineRows,
      summary,
      canEdit,
      activityStatuses: ACTIVITY_STATUS,
      thaiDate,
      formatMonthLabel: toThaiMonthLabel
    });
  } catch (error) {
    console.error('Error loading project summary:', error);
    res.status(500).send('ไม่สามารถโหลดข้อมูลสรุปโครงการได้');
  }
};
