const PlanKpi = require('../models/planKpi');
const PlanProject = require('../models/planProject');
const PlanKpiMonthly = require('../models/planKpiMonthly');

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
