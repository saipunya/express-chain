const PlanKpi = require('../models/planKpi');
const PlanProject = require('../models/planProject');
const PlanKpiMonthly = require('../models/planKpiMonthly');
const db = require('../config/db');

const TH_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม'
];

const normalizeMonthInput = (value) => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 10);
  }
  return null;
};

const toMonthLabel = (value) => {
  if (!value) {
    return '-';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const monthIndex = value.getMonth();
    const monthName = TH_MONTHS[monthIndex] || String(monthIndex + 1).padStart(2, '0');
    const buddhistYear = year + 543;
    return `${monthName} ${buddhistYear}`;
  }

  if (typeof value === 'string' && value.length >= 7) {
    const [year, month] = value.split('-');
    const monthIndex = Number(month) - 1;
    const monthName = TH_MONTHS[monthIndex] || month;
    const buddhistYear = Number(year) + 543;
    return `${monthName} ${buddhistYear}`;
  }

  return String(value);
};

// List all KPIs (optionally filter by project code ?pro_code=...)
exports.index = async (req, res) => {
  const { pro_code } = req.query;
  let kpis;

  if (pro_code) {
    kpis = await PlanKpi.findByProjectCode(pro_code);
  } else {
    kpis = await PlanKpi.findAll();
  }

  const kpiIds = kpis.map((k) => k.kp_id);
  const monthlyTotals = await PlanKpiMonthly.sumForIds(kpiIds);

  const enrichedKpis = kpis.map((k) => {
    const total = monthlyTotals[k.kp_id] ?? 0;
    const targetValue = Number(k.kp_plan || 0);
    const achievementPercent = targetValue ? (total / targetValue) * 100 : null;

    return {
      ...k,
      monthly_total: total,
      achievement_percent: achievementPercent
    };
  });

  res.render('planKpi/index', { kpis: enrichedKpis, pro_code });
};

// Show create form
exports.create = async (req, res) => {
  const projects = await PlanProject.findAll();
  const pro_code = req.query.pro_code || '';
  res.render('planKpi/create', { projects, pro_code });
};

// Store new KPI
exports.store = async (req, res) => {
  const payload = {
    kp_number: parseInt(req.body.kp_number || '0', 10),
    kp_subject: req.body.kp_subject || '',
    kp_plan: parseInt(req.body.kp_plan || '0', 10),
    kp_action: parseInt(req.body.kp_action || '0', 10),
    kp_unit: req.body.kp_unit || '',
    kp_procode: req.body.kp_procode || '',
    kp_saveby: req.session?.user?.username || req.body.kp_saveby || 'system',
    kp_savedate: req.body.kp_savedate || new Date().toISOString().slice(0, 10)
  };

  await PlanKpi.create(payload);

  const redirectCode = payload.kp_procode ? `?pro_code=${encodeURIComponent(payload.kp_procode)}` : '';
  res.redirect('/plankpi' + redirectCode);
};

// Show edit form
exports.edit = async (req, res) => {
  const kpi = await PlanKpi.findByPk(req.params.id);
  const projects = await PlanProject.findAll();
  res.render('planKpi/edit', { kpi, projects });
};

// Update KPI
exports.update = async (req, res) => {
  const existing = await PlanKpi.findByPk(req.params.id);

  const payload = {
    kp_number: parseInt(req.body.kp_number || String(existing.kp_number || 0), 10),
    kp_subject: req.body.kp_subject || existing.kp_subject || '',
    kp_plan: parseInt(req.body.kp_plan || String(existing.kp_plan || 0), 10),
    kp_action: parseInt(req.body.kp_action || String(existing.kp_action || 0), 10),
    kp_unit: req.body.kp_unit || existing.kp_unit || '',
    kp_procode: req.body.kp_procode || existing.kp_procode || '',
    kp_saveby: req.session?.user?.username || existing.kp_saveby || 'system',
    kp_savedate: req.body.kp_savedate || existing.kp_savedate
  };

  await PlanKpi.update(req.params.id, payload);

  const redirectCode = payload.kp_procode ? `?pro_code=${encodeURIComponent(payload.kp_procode)}` : '';
  res.redirect('/plankpi' + redirectCode);
};

// Delete KPI
exports.destroy = async (req, res) => {
  const existing = await PlanKpi.findByPk(req.params.id);
  await PlanKpi.destroy(req.params.id);
  const redirectCode = existing?.kp_procode ? `?pro_code=${encodeURIComponent(existing.kp_procode)}` : '';
  res.redirect('/plankpi' + redirectCode);
};

// KPI overview across all projects
exports.overview = async (req, res) => {
  const overviewSql = `
    SELECT
      ma.ma_code,
      ma.ma_subject AS plan_name,
      p.pro_code,
      p.pro_subject AS project_name,
      k.kp_id,
      k.kp_number,
      k.kp_subject AS kpi_name,
      k.kp_unit,
      k.kp_plan,
      COALESCE(SUM(m.actual_value), 0) AS actual_total,
      MAX(m.report_month) AS latest_month
    FROM plan_project p
    JOIN plan_main ma ON ma.ma_code = p.pro_macode
    JOIN plan_kpi k ON k.kp_procode = p.pro_code
    LEFT JOIN plan_kpi_monthly m ON m.kp_id = k.kp_id
    GROUP BY ma.ma_code, ma.ma_subject, p.pro_code, p.pro_subject, k.kp_id, k.kp_number, k.kp_subject, k.kp_unit, k.kp_plan
    ORDER BY ma.ma_code, p.pro_code, k.kp_number, k.kp_id
  `;

  const [rows] = await db.query(overviewSql);

  const plansMap = new Map();

  rows.forEach((row) => {
    const achievementPercent = row.kp_plan ? (Number(row.actual_total || 0) / Number(row.kp_plan)) * 100 : null;
    const plan = plansMap.get(row.ma_code) || {
      ma_code: row.ma_code,
      plan_name: row.plan_name,
      projects: new Map()
    };
    const project = plan.projects.get(row.pro_code) || {
      pro_code: row.pro_code,
      project_name: row.project_name,
      kpis: []
    };

    const latestMonthIso = row.latest_month
      ? (row.latest_month instanceof Date
          ? row.latest_month.toISOString().slice(0, 7)
          : String(row.latest_month).slice(0, 7))
      : null;
    const latestMonthLabel = row.latest_month ? toMonthLabel(row.latest_month) : '-';

    project.kpis.push({
      kp_id: row.kp_id,
      kp_number: row.kp_number,
      kpi_name: row.kpi_name,
      unit: row.kp_unit,
      target: Number(row.kp_plan || 0),
      actual: Number(row.actual_total || 0),
      achievement_percent: achievementPercent,
      latest_month_iso: latestMonthIso,
      latest_month_label: latestMonthLabel
    });

    plan.projects.set(row.pro_code, project);
    plansMap.set(row.ma_code, plan);
  });

  const plans = Array.from(plansMap.values()).map((plan) => ({
    ...plan,
    projects: Array.from(plan.projects.values())
  }));

  res.render('planKpi/overview', { plans });
};

exports.report = async (req, res) => {
  const kpId = Number(req.params.id);
  const kpi = await PlanKpi.findByPk(kpId);

  if (!kpi) {
    return res.status(404).send('ไม่พบบันทึกตัวชี้วัด');
  }

  const monthlyReports = await PlanKpiMonthly.findByKpi(kpId);
  const reports = monthlyReports.map((report) => {
    const rawMonth = report.report_month instanceof Date
      ? report.report_month.toISOString().slice(0, 10)
      : String(report.report_month);

    return {
      ...report,
      iso_month: rawMonth.slice(0, 7),
      month_label: toMonthLabel(report.report_month)
    };
  });

  const totalActual = reports.reduce((sum, report) => sum + Number(report.actual_value || 0), 0);
  const targetValue = Number(kpi.kp_plan || 0);
  const achievementPercent = targetValue ? (totalActual / targetValue) * 100 : null;

  const currentMonth = new Date().toISOString().slice(0, 7);

  res.render('planKpi/report', {
    kpi,
    reports,
    totalActual,
    achievementPercent,
    currentMonth
  });
};

exports.storeMonthly = async (req, res) => {
  const kpId = Number(req.params.id);
  const kpi = await PlanKpi.findByPk(kpId);

  if (!kpi) {
    return res.status(404).send('ไม่พบบันทึกตัวชี้วัด');
  }

  const normalizedMonth = normalizeMonthInput(req.body.report_month);
  const actualValue = Number.parseFloat(req.body.actual_value || '0');

  if (!normalizedMonth || Number.isNaN(actualValue)) {
    return res.status(400).send('ข้อมูลรายเดือนไม่ถูกต้อง');
  }

  const note = req.body.note || '';
  const createdBy = req.session?.user?.username || req.body.created_by || 'system';
  const existingReport = await PlanKpiMonthly.findByMonth(kpId, normalizedMonth);

  if (existingReport) {
    await PlanKpiMonthly.update(existingReport.id, {
      report_month: normalizedMonth,
      actual_value: actualValue,
      note,
      created_by: createdBy
    });
  } else {
    await PlanKpiMonthly.create({
      kp_id: kpId,
      report_month: normalizedMonth,
      actual_value: actualValue,
      note,
      created_by: createdBy
    });
  }

  res.redirect(`/plankpi/${kpId}/report`);
};

exports.destroyMonthly = async (req, res) => {
  const kpId = Number(req.params.id);
  const reportId = Number(req.params.reportId);
  const kpi = await PlanKpi.findByPk(kpId);

  if (!kpi) {
    return res.status(404).send('ไม่พบบันทึกตัวชี้วัด');
  }

  const report = await PlanKpiMonthly.findByPk(reportId);

  if (report && report.kp_id === kpId) {
    await PlanKpiMonthly.destroy(reportId);
  }

  res.redirect(`/plankpi/${kpId}/report`);
};
