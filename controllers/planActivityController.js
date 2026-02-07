const PlanActivity = require('../models/planActivity');
const PlanProject = require('../models/planProject');
const PlanActivityMonthly = require('../models/planActivityMonthly');
const PlanKpi = require('../models/planKpi');
const PlanKpiMonthly = require('../models/planKpiMonthly');
const AttachmentModel = require('../models/planActivityMonthlyAttachment');

const STATUS_OPTIONS = [
  { value: 2, label: 'ดำเนินการเรียบร้อย', badge: 'success', icon: 'check-circle' },
  { value: 1, label: 'อยู่ระหว่างดำเนินการ', badge: 'warning text-dark', icon: 'hourglass-split' },
  { value: 0, label: 'ยังไม่ดำเนินการ', badge: 'secondary', icon: 'clock' }
];

const TH_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];

/* =========================
   Helpers
========================= */

const normalizeMonthInput = (value) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7) + '-01';
  }

  return null;
};

const toThaiMonthLabel = (value) => {
  if (!value) return '';
  const [y, m] = value.split('-');
  const monthName = TH_MONTHS[Number(m) - 1] || m;
  return `${monthName} ${Number(y) + 543}`;
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

// Supports both nested payloads (status: {"12":"1"}) and flattened bracket keys ("status[12]":"1").
const extractFieldMap = (payload, fieldName) => {
  if (!payload) {
    return {};
  }

  const direct = payload[fieldName];
  if (isPlainObject(direct)) {
    return direct;
  }

  const prefix = `${fieldName}[`;
  const suffix = ']';
  const underscorePrefix = `${fieldName}_`;

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (typeof key !== 'string' || !key.startsWith(prefix) || !key.endsWith(suffix)) {
      // Also support flat keys like status_12 / note_12
      if (typeof key === 'string' && key.startsWith(underscorePrefix)) {
        const innerKey = key.slice(underscorePrefix.length);
        if (innerKey) {
          acc[innerKey] = value;
        }
      }
      return acc;
    }

    const innerKey = key.slice(prefix.length, -suffix.length);
    if (innerKey) {
      acc[innerKey] = value;
    }

    return acc;
  }, {});
};

/* =========================
   Basic CRUD
========================= */

exports.index = async (req, res) => {
  const activities = await PlanActivity.findAll();
  res.render('planActivity/index', { activities });
};

exports.selectProjectPage = async (req, res) => {
  const projects = await PlanProject.findAll();
  res.render('planActivity/select-project', { projects });
};

exports.create = async (req, res) => {
  const projects = await PlanProject.findAll();
  res.render('planActivity/create', {
    projects,
    pro_code: req.query.pro_code || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || 'system'
  });
};

exports.createMany = async (req, res) => {
  const projects = await PlanProject.findAll();
  res.render('planActivity/create-many', {
    projects,
    pro_code: req.query.pro_code || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || 'system'
  });
};

exports.store = async (req, res) => {
  await PlanActivity.create({
    ac_number: Number(req.body.ac_number || 0),
    ac_subject: req.body.ac_subject || '',
    ac_status: Number(req.body.ac_status || 0),
    ac_procode: req.body.ac_procode || '',
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || 'system',
    ac_savedate: req.body.ac_savedate || new Date().toISOString().slice(0, 10)
  });
  res.redirect('/planactivity');
};

exports.storeMany = async (req, res) => {
  let { activities } = req.body;

  if (!activities) {
    return res.status(400).send('Missing activities');
  }

  if (!Array.isArray(activities)) {
    if (activities && typeof activities === 'object') {
      activities = Object.keys(activities)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => activities[key]);
    } else {
      activities = [activities];
    }
  }

  const fallbackSaveBy = req.session?.user?.username || req.session?.user?.fullname || 'system';
  const today = new Date().toISOString().slice(0, 10);

  const items = activities
    .map((row) => ({
      ac_number: Number(row.ac_number || 0),
      ac_subject: (row.ac_subject || '').trim(),
      ac_status: Number(row.ac_status ?? 0),
      ac_procode: (row.ac_procode || req.body.pro_code || '').trim(),
      ac_saveby: (row.ac_saveby || req.body.ac_saveby || fallbackSaveBy).trim(),
      ac_savedate: row.ac_savedate || req.body.ac_savedate || today
    }))
    .filter((row) => row.ac_subject && row.ac_procode);

  if (!items.length) {
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

exports.edit = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  const projects = await PlanProject.findAll();
  res.render('planActivity/edit', { activity, projects });
};

exports.update = async (req, res) => {
  const existing = await PlanActivity.findByPk(req.params.id);
  await PlanActivity.update(req.params.id, {
    ac_number: Number(req.body.ac_number || existing.ac_number),
    ac_subject: req.body.ac_subject || existing.ac_subject,
    ac_status: Number(req.body.ac_status ?? existing.ac_status),
    ac_procode: req.body.ac_procode || existing.ac_procode,
    ac_saveby: req.session?.user?.username || req.session?.user?.fullname || existing.ac_saveby,
    ac_savedate: req.body.ac_savedate || existing.ac_savedate
  });
  res.redirect('/planactivity');
};

exports.destroy = async (req, res) => {
  await PlanActivity.destroy(req.params.id);
  res.redirect('/planactivity');
};

exports.show = async (req, res) => {
  const activity = await PlanActivity.findByPk(req.params.id);
  res.render('planActivity/show', { activity });
};

/* =========================
   Monthly Report (GET)
========================= */

exports.monthlyReport = async (req, res) => {
  // Avoid 304 caching that can make the UI appear unchanged after POST/redirect.
  res.set('Cache-Control', 'no-store');

  const isAdmin = req.session?.user?.mClass === 'admin';
  const userId = Number(req.session?.user?.id);
  const projects = isAdmin
    ? await PlanProject.findAll()
    : (userId ? await PlanProject.findAllByResponsibleId(userId) : []);
  const selectedProject = req.query.pro_code || '';

  const selectedMonth = req.query.month || new Date().toISOString().slice(0, 7);
  const normalizedMonth = normalizeMonthInput(selectedMonth) || normalizeMonthInput(new Date().toISOString().slice(0, 7));
  const monthLabel = toThaiMonthLabel(normalizedMonth);

  let activities = [];
  let statusesMap = {};
  let kpiMetrics = [];
  let kpiSummary = { total: 0, achieved: 0, onTrack: 0, behind: 0, noTarget: 0 };
  let historicalRecords = [];
  let attachments = [];

  if (selectedProject) {
    activities = await PlanActivity.findByProjectCode(selectedProject);
    if (activities.length) {
      const rows = await PlanActivityMonthly.findByActivitiesAndMonth(
        activities.map((a) => a.ac_id),
        normalizedMonth
      );

      // If the DB has duplicates (shouldn't), prefer latest rows (model orders by updated_at DESC).
      statusesMap = rows.reduce((acc, row) => {
        if (!acc[row.ac_id]) {
          acc[row.ac_id] = row;
        }
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

      kpiSummary = kpiMetrics.reduce(
        (acc, kpi) => {
          if (kpi.achievement_percent === null) acc.noTarget += 1;
          else if (kpi.achievement_percent >= 100) acc.achieved += 1;
          else if (kpi.achievement_percent >= 70) acc.onTrack += 1;
          else acc.behind += 1;
          return acc;
        },
        { total: kpiMetrics.length, achieved: 0, onTrack: 0, behind: 0, noTarget: 0 }
      );
    }

    // Fetch historical monthly records
    try {
      const db = require('../config/db');
      const query = `
        SELECT DISTINCT 
          am.report_month,
          COUNT(am.ac_id) as total_activities,
          SUM(CASE WHEN am.status = 2 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN am.status = 1 THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN am.status = 0 OR am.status IS NULL THEN 1 ELSE 0 END) as not_started
        FROM activity_monthly am
        WHERE am.pro_code = ?
        GROUP BY am.report_month
        ORDER BY am.report_month DESC
        LIMIT 12
      `;
      const [rows] = await db.promise().query(query, [selectedProject]);
      historicalRecords = Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.error('Error fetching historical records:', error);
      historicalRecords = [];
    }
    attachments = await AttachmentModel.findByProjectAndMonth(selectedProject, normalizedMonth);
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
    monthLabel,
    historicalRecords,
    attachments,
    attachmentUploadError: req.query.upload_error
  });
};

/* =========================
   Monthly Status Save (POST)
========================= */

exports.storeMonthlyStatuses = async (req, res) => {
  const normalizedMonth = normalizeMonthInput(req.body.report_month);
  const proCode = req.body.pro_code;

  if (!proCode || !normalizedMonth) {
    return res.status(400).send('ข้อมูลโครงการหรือเดือนที่รายงานไม่ถูกต้อง');
  }

  const activities = await PlanActivity.findByProjectCode(proCode);
  if (!activities.length) {
    return res.redirect(`/planactivity/report?pro_code=${proCode}&month=${normalizedMonth}`);
  }

  const allowedIds = new Set(activities.map(a => String(a.ac_id)));
  const updatedBy = req.session?.user?.username || req.session?.user?.fullname || 'system';

  const statusMap = extractFieldMap(req.body, 'status');
  const noteMap = extractFieldMap(req.body, 'note');
  const validStatuses = new Set([0, 1, 2]);

  if (!statusMap || Object.keys(statusMap).length === 0) {
    // If the request hits this route but has no status payload, nothing will be saved.
    // Log minimal info to help diagnose form/body parsing issues.
    console.warn('[planactivity][report] Missing status payload', {
      proCode,
      report_month: req.body.report_month,
      normalizedMonth,
      bodyKeys: Object.keys(req.body || {})
    });
    return res.status(400).send('ไม่พบข้อมูลสถานะกิจกรรมจากฟอร์ม (status payload ว่าง)');
  }

  const rows = Object.entries(statusMap)
    .map(([acId, status]) => {
      const acIdKey = String(acId);
      if (!allowedIds.has(acIdKey)) return null;

      const parsedId = Number.parseInt(acIdKey, 10);
      const parsedStatus = Number.parseInt(status, 10);
      if (!Number.isInteger(parsedId) || !validStatuses.has(parsedStatus)) {
        return null;
      }

      const rawNote = noteMap[acIdKey];
      const trimmedNote = typeof rawNote === 'string' ? rawNote.trim() : '';

      return {
        ac_id: parsedId,
        report_month: normalizedMonth,
        status: parsedStatus,
        note: trimmedNote ? trimmedNote : null,
        updated_by: updatedBy
      };
    })
    .filter(Boolean);

  if (rows.length) {
    await PlanActivityMonthly.upsertStatuses(rows);
    await PlanActivity.updateStatuses(
      rows.map(r => ({ ac_id: r.ac_id, status: r.status }))
    );
  }

  res.redirect(`/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${normalizedMonth.slice(0, 7)}`);
};

/* =========================
   Monthly KPI Save (POST)
========================= */

exports.storeMonthlyKpi = async (req, res) => {
  const proCode = req.body.pro_code;
  const normalizedMonth = normalizeMonthInput(req.body.report_month);

  if (!proCode || !normalizedMonth) {
    return res.status(400).send('ข้อมูลโครงการหรือเดือนที่รายงานไม่ถูกต้อง');
  }

  const createdBy = req.session?.user?.username || req.session?.user?.fullname || 'system';

  const structuredInput = req.body.kpi_rows || null;
  const entries = Array.isArray(structuredInput)
    ? structuredInput
    : structuredInput && typeof structuredInput === 'object'
      ? Object.keys(structuredInput)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => structuredInput[key])
      : [];

  // Only allow KPI ids from this project
  const kpis = await PlanKpi.findByProjectCode(proCode);
  const allowedKpiIds = new Set(kpis.map((kpi) => Number(kpi.kp_id)));

  const rows = entries
    .map((entry) => {
      if (!entry) return null;

      const kpId = Number.parseInt(entry.kp_id || entry.id || entry.kpi_id, 10);
      const rawValue = entry.actual_value ?? entry.value;
      if (!kpId || rawValue === undefined || rawValue === '') return null;

      if (!allowedKpiIds.has(kpId)) return null;

      const numericValue = Number.parseFloat(rawValue);
      if (Number.isNaN(numericValue)) return null;

      const note = typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim() : null;

      return {
        kp_id: kpId,
        report_month: normalizedMonth,
        actual_value: numericValue,
        note,
        created_by: createdBy
      };
    })
    .filter(Boolean);

  if (rows.length) {
    await PlanKpiMonthly.upsertMany(rows);
  }

  res.redirect(`/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${normalizedMonth.slice(0, 7)}`);
};

/* =========================
   API: Get Activities by Project
========================= */
exports.getActivitiesByProject = async (req, res) => {
  try {
    const { pro_code } = req.query;

    if (!pro_code) {
      return res.status(400).json({ error: 'pro_code is required' });
    }

    const activities = await PlanActivity.findByProjectCode(pro_code);
    
    return res.json(activities || []);
  } catch (error) {
    console.error('Error in getActivitiesByProject:', error);
    return res.status(500).json({ error: 'Failed to fetch activities', details: error.message });
  }
};
