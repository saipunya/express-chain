const PlanActivity = require('../models/planActivity');
const PlanProject = require('../models/planProject');
const PlanActivityMonthly = require('../models/planActivityMonthly');
const PlanKpi = require('../models/planKpi');
const PlanKpiMonthly = require('../models/planKpiMonthly');

const STATUS_OPTIONS = [
  { value: 2, label: 'ดำเนินการเรียบร้อย', badge: 'success', icon: 'check-circle' },
  { value: 1, label: 'อยู่ระหว่างดำเนินการ', badge: 'warning text-dark', icon: 'hourglass-split' },
  { value: 0, label: 'ยังไม่ดำเนินการ', badge: 'secondary', icon: 'clock' }
];

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

const toThaiMonthLabel = (value) => {
  if (!value) {
    return '';
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

const extractBracketFieldMap = (payload, fieldName) => {
  if (!payload) {
    return {};
  }

  const direct = payload[fieldName];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct;
  }

  const prefix = `${fieldName}[`;
  const suffix = ']';

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (typeof key !== 'string' || !key.startsWith(prefix) || !key.endsWith(suffix)) {
      return acc;
    }

    const innerKey = key.slice(prefix.length, -1);
    if (innerKey) {
      acc[innerKey] = value;
    }

    return acc;
  }, {});
};

// List all activities
exports.index = async (req, res) => {
  const activities = await PlanActivity.findAll();
  res.render('planActivity/index', { activities });
};

// Select project page (before creating activities)
exports.selectProjectPage = async (req, res) => {
  const projects = await PlanProject.findAll();
  res.render('planActivity/select-project', { projects });
};

// Show create form
exports.create = async (req, res) => {
  const projects = await PlanProject.findAll();
  const pro_code = req.query.pro_code || '';
  const ac_saveby = req.session?.user?.username || req.session?.user?.fullname || 'system';
  res.render('planActivity/create', { projects, pro_code, ac_saveby });
};

// Show bulk create form
exports.createMany = async (req, res) => {
  const projects = await PlanProject.findAll();
  const pro_code = req.query.pro_code || '';
  const ac_saveby = req.session?.user?.username || req.session?.user?.fullname || 'system';
  res.render('planActivity/create-many', { projects, pro_code, ac_saveby });
};

// Store new activity
exports.store = async (req, res) => {
  const payload = {
    ac_number: parseInt(req.body.ac_number || '0', 10),
    ac_subject: req.body.ac_subject || '',
    ac_status: parseInt(req.body.ac_status ?? '0', 10),
    ac_procode: req.body.ac_procode || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || req.body.ac_saveby || 'system',
    ac_savedate: req.body.ac_savedate || new Date().toISOString().slice(0, 10)
  };

  await PlanActivity.create(payload);
  res.redirect('/planactivity');
};

// Store many activities at once
exports.storeMany = async (req, res) => {
  let { activities } = req.body;

  if (!activities) {
    return res.status(400).send('Missing activities');
  }

  if (!Array.isArray(activities)) {
    if (activities && typeof activities === 'object') {
      activities = Object.keys(activities)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => activities[k]);
    } else {
      activities = [activities];
    }
  }

  const fallbackSaveBy = req.session?.user?.username || req.session?.user?.fullname || 'system';
  const today = new Date().toISOString().slice(0, 10);

  const items = activities
    .map((row) => ({
      ac_number: parseInt(row.ac_number || '0', 10),
      ac_subject: (row.ac_subject || '').trim(),
      ac_status: parseInt(row.ac_status ?? '0', 10),
      ac_procode: (row.ac_procode || req.body.pro_code || '').trim(),
      ac_saveby: (row.ac_saveby || req.body.ac_saveby || fallbackSaveBy).trim(),
      ac_savedate: row.ac_savedate || req.body.ac_savedate || today
    }))
    .filter((row) => row.ac_subject && row.ac_procode);

  if (items.length === 0) {
    return res.status(400).send('No valid activity rows');
  }

  if (typeof PlanActivity.createMany === 'function') {
    await PlanActivity.createMany(items);
  } else {
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      await PlanActivity.create(item);
    }
  }

  res.redirect('/planactivity');
};

// Show edit form
exports.edit = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  const projects = await PlanProject.findAll();
  res.render('planActivity/edit', { activity, projects });
};

// Update activity
exports.update = async (req, res) => {
  const existing = await PlanActivity.findByPk(req.params.id);
  const payload = {
    ac_number: parseInt(req.body.ac_number || String(existing?.ac_number || 0), 10),
    ac_subject: req.body.ac_subject || existing?.ac_subject || '',
    ac_status: parseInt(req.body.ac_status ?? String(existing?.ac_status ?? 0), 10),
    ac_procode: req.body.ac_procode || existing?.ac_procode || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || existing?.ac_saveby || 'system',
    ac_savedate: req.body.ac_savedate || existing?.ac_savedate || new Date().toISOString().slice(0, 10)
  };
  await PlanActivity.update(req.params.id, payload);
  res.redirect('/planactivity');
};

// Delete activity
exports.destroy = async (req, res) => {
  await PlanActivity.destroy(req.params.id);
  res.redirect('/planactivity');
};

// Show detail
exports.show = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  res.render('planActivity/show', { activity });
};

// Monthly reporting page for activity statuses
exports.monthlyReport = async (req, res) => {
  const projects = await PlanProject.findAll();
  const selectedProject = req.query.pro_code || '';
  const selectedMonth = req.query.month || new Date().toISOString().slice(0, 7);
  const normalizedMonth = normalizeMonthInput(selectedMonth) || new Date().toISOString().slice(0, 10);
  const monthLabel = toThaiMonthLabel(normalizedMonth);

  let activities = [];
  let statusesMap = {};
  let kpiMetrics = [];
  let kpiSummary = { total: 0, achieved: 0, onTrack: 0, behind: 0, noTarget: 0 };

  if (selectedProject) {
    activities = await PlanActivity.findByProjectCode(selectedProject);
    if (activities.length) {
      const rows = await PlanActivityMonthly.findByActivitiesAndMonth(
        activities.map((a) => a.ac_id),
        normalizedMonth
      );
      statusesMap = rows.reduce((acc, row) => {
        acc[row.ac_id] = row;
        return acc;
      }, {});
    }

    const kpis = await PlanKpi.findByProjectCode(selectedProject);
    if (kpis.length) {
      const kpiIds = kpis.map((kpi) => kpi.kp_id);
      const monthlyRows = await PlanKpiMonthly.findByKpiIdsAndMonth(kpiIds, normalizedMonth);
      const monthlyMap = monthlyRows.reduce((acc, row) => {
        acc[row.kp_id] = row;
        return acc;
      }, {});
      const totals = await PlanKpiMonthly.sumForIds(kpiIds);

      kpiMetrics = kpis.map((kpi) => {
        const cumulativeTotal = Number(totals[kpi.kp_id] ?? 0);
        const targetValue = Number(kpi.kp_plan || 0);
        const achievementPercent = targetValue ? (cumulativeTotal / targetValue) * 100 : null;
        return {
          ...kpi,
          cumulative_total: cumulativeTotal,
          achievement_percent: achievementPercent,
          monthly_record: monthlyMap[kpi.kp_id] || null
        };
      });

      const baseSummary = { total: kpiMetrics.length, achieved: 0, onTrack: 0, behind: 0, noTarget: 0 };
      kpiSummary = kpiMetrics.reduce((acc, kpi) => {
        if (kpi.achievement_percent === null) {
          acc.noTarget += 1;
        } else if (kpi.achievement_percent >= 100) {
          acc.achieved += 1;
        } else if (kpi.achievement_percent >= 70) {
          acc.onTrack += 1;
        } else {
          acc.behind += 1;
        }
        return acc;
      }, baseSummary);
    }
  }

  const summary = activities.reduce(
    (acc, activity) => {
      const status = Number(statusesMap[activity.ac_id]?.status ?? -1);
      if (status === 2) acc.completed += 1;
      else if (status === 1) acc.inProgress += 1;
      else if (status === 0) acc.notStarted += 1;
      else acc.pending += 1;
      return acc;
    },
    { completed: 0, inProgress: 0, notStarted: 0, pending: 0 }
  );

  res.render('planActivity/report', {
    projects,
    activities,
    statusesMap,
    selectedProject,
    selectedMonth,
    statusOptions: STATUS_OPTIONS,
    summary,
    totalActivities: activities.length,
    kpiMetrics,
    kpiSummary,
    monthLabel
  });
};

// Store monthly statuses for activities
exports.storeMonthlyStatuses = async (req, res) => {
  const { pro_code: proCode, report_month: reportMonthInput } = req.body;
  const normalizedMonth = normalizeMonthInput(reportMonthInput);

  if (!proCode || !normalizedMonth) {
    return res.status(400).send('ข้อมูลโครงการหรือเดือนที่รายงานไม่ถูกต้อง');
  }

  const activities = await PlanActivity.findByProjectCode(proCode);

  if (!activities.length) {
    return res.redirect(`/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${normalizedMonth.slice(0, 7)}`);
  }

  const statusInputs = extractBracketFieldMap(req.body, 'status');
  const noteInputs = extractBracketFieldMap(req.body, 'note');
  const updatedBy = req.session?.user?.username || req.session?.user?.fullname || 'system';

  const validStatuses = new Set([0, 1, 2]);

  const rows = activities
    .map((activity) => {
      const raw = statusInputs[activity.ac_id] ?? statusInputs[String(activity.ac_id)];
      if (raw === undefined || raw === '') {
        return null;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!validStatuses.has(parsed)) {
        return null;
      }
      return {
        ac_id: activity.ac_id,
        report_month: normalizedMonth,
        status: parsed,
        note: noteInputs[activity.ac_id] || noteInputs[String(activity.ac_id)] || null,
        updated_by: updatedBy
      };
    })
    .filter(Boolean);

  if (rows.length) {
    await PlanActivityMonthly.upsertStatuses(rows);
    await PlanActivity.updateStatuses(rows.map(({ ac_id, status }) => ({ ac_id, status })));
  }

  res.redirect(`/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${normalizedMonth.slice(0, 7)}`);
};

// Store monthly KPI performance values for a project
exports.storeMonthlyKpi = async (req, res) => {
  const { pro_code: proCode, report_month: reportMonthInput } = req.body;
  const normalizedMonth = normalizeMonthInput(reportMonthInput);

  if (!proCode || !normalizedMonth) {
    return res.status(400).send('ข้อมูลโครงการหรือเดือนที่รายงานไม่ถูกต้อง');
  }

  const kpis = await PlanKpi.findByProjectCode(proCode);

  if (!kpis.length) {
    return res.redirect(`/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${normalizedMonth.slice(0, 7)}`);
  }

  const actualInputs = req.body.actual_value || {};
  const noteInputs = req.body.kpi_note || {};
  const createdBy = req.session?.user?.username || req.session?.user?.fullname || 'system';
  const structuredInput = req.body.kpi_rows || null;
  let structuredRows = [];

  if (structuredInput) {
    const entries = Array.isArray(structuredInput)
      ? structuredInput
      : Object.keys(structuredInput)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => structuredInput[key]);

    structuredRows = entries
      .map((entry) => {
        if (!entry) {
          return null;
        }

        const kpId = Number.parseInt(entry.kp_id || entry.id || entry.kpi_id, 10);
        const rawValue = entry.actual_value ?? entry.value;

        if (!kpId || rawValue === undefined || rawValue === '') {
          return null;
        }

        const numericValue = Number.parseFloat(rawValue);
        if (Number.isNaN(numericValue)) {
          return null;
        }

        return {
          kp_id: kpId,
          report_month: normalizedMonth,
          actual_value: numericValue,
          note: entry.note?.trim() ? entry.note.trim() : null,
          created_by: createdBy
        };
      })
      .filter(Boolean);
  }

  const fallbackRows = structuredRows.length
    ? []
    : kpis
        .map((kpi) => {
          const rawValue = actualInputs[kpi.kp_id] ?? actualInputs[String(kpi.kp_id)];
          if (rawValue === undefined || rawValue === '') {
            return null;
          }

          const numericValue = Number.parseFloat(rawValue);
          if (Number.isNaN(numericValue)) {
            return null;
          }

          return {
            kp_id: kpi.kp_id,
            report_month: normalizedMonth,
            actual_value: numericValue,
            note: noteInputs[kpi.kp_id] || noteInputs[String(kpi.kp_id)] || null,
            created_by: createdBy
          };
        })
        .filter(Boolean);

  const rows = structuredRows.length ? structuredRows : fallbackRows;

  if (rows.length) {
    await PlanKpiMonthly.upsertMany(rows);
  }

  res.redirect(`/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${normalizedMonth.slice(0, 7)}`);
};
