const fs = require('fs');
const path = require('path');
const PbtPlan = require('../models/pbtPlanModel');

const PLAN_OPTIONS = [
  { value: 'a', label: 'แผนงานพื้นฐานด้านการสร้างความสามารถในการแข่งขัน' },
  { value: 'b', label: 'แผนงานยุทธศาสตร์เสริมสร้างพลังทางสังคม' },
  { value: 'c', label: 'แผนงานพัฒนาและส่งเสริมเศรษฐกิจฐานราก' },
  { value: 'd', label: 'แผนงานยุทธศาสตร์การเกษตรสร้างมูลค่า' }
];

const getThaiYear = () => String(new Date().getFullYear() + 543);

const getSaveBy = (req) => req.session?.user?.fullname || req.session?.user?.username || 'system';

const getSavedate = () => new Date().toISOString().slice(0, 10);

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ({ _key: key, ...value[key] }));
  }
  return [value];
};

const getFileMap = (files = []) => {
  return files.reduce((acc, file) => {
    acc[file.fieldname] = file;
    return acc;
  }, {});
};

const buildDuplicateKey = (row = {}) => {
  const year = (row.p_year ?? '').toString().trim();
  const month = (row.p_month ?? '').toString().trim();
  const plan = (row.p_plan ?? '').toString().trim();
  const code = (row.p_code ?? '').toString().trim();
  return `${year}|${month}|${plan}|${code}`;
};

const findDuplicateRows = async (items = [], excludeId = null) => {
  if (!items.length) return [];

  const [firstItem] = items;
  const periodRows = await PbtPlan.getByPeriod(firstItem.p_year, firstItem.p_month);
  const existingKeys = new Set(
    periodRows
      .filter((row) => String(row.p_id ?? '') !== String(excludeId ?? ''))
      .map(buildDuplicateKey)
  );

  const seenKeys = new Set();
  return items.filter((item) => {
    const key = buildDuplicateKey(item);
    if (!key) return false;
    if (seenKeys.has(key) || existingKeys.has(key)) return true;
    seenKeys.add(key);
    return false;
  });
};

const formatDuplicateLabel = (row = {}) => {
  const plan = (row.p_plan ?? '').toString().trim().toUpperCase();
  const code = (row.p_code ?? '').toString().trim();
  return `${plan || '-'} / ${code || '-'}`;
};

const getUploadPath = (filename) => path.join(__dirname, '..', 'uploads', 'pbt-plan', filename);

const removeUploadedFile = (filename) => {
  if (!filename) return;
  const filePath = getUploadPath(filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const getPeriodKey = (row) => {
  const year = (row?.p_year ?? '').toString().trim();
  const month = (row?.p_month ?? '').toString().trim().padStart(2, '0');
  return `${year}-${month}`;
};

const formatPeriodLabel = (periodKey) => {
  if (!periodKey || !periodKey.includes('-')) return periodKey || '';
  const [year, month] = periodKey.split('-');
  const monthName = MONTH_NAMES_TH[Number(month) - 1] || month;
  return `${monthName} ${year}`;
};

const buildPeriodOptions = (rows) => {
  const seen = new Map();

  rows.forEach((row) => {
    const key = getPeriodKey(row);
    if (!key || seen.has(key)) return;
    seen.set(key, {
      value: key,
      label: formatPeriodLabel(key),
      year: row.p_year,
      month: row.p_month
    });
  });

  return Array.from(seen.values()).sort((a, b) => {
    const yearDiff = Number(b.year) - Number(a.year);
    if (yearDiff !== 0) return yearDiff;
    return Number(b.month) - Number(a.month);
  });
};

const groupRowsByPlan = (rows) => {
  return rows.reduce((acc, row) => {
    const key = row.p_plan || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
};

const buildPlanSections = (rows, mode, selectedPeriod) => {
  const rowsByPlan = {};

  if (mode === 'latest') {
    const latestPeriodByPlan = {};

    rows.forEach((row) => {
      const planKey = row.p_plan || '';
      const periodKey = getPeriodKey(row);

      if (!latestPeriodByPlan[planKey]) {
        latestPeriodByPlan[planKey] = periodKey;
      }

      if (latestPeriodByPlan[planKey] === periodKey) {
        if (!rowsByPlan[planKey]) rowsByPlan[planKey] = [];
        rowsByPlan[planKey].push(row);
      }
    });

    return PLAN_OPTIONS.map((option) => {
      const rowsForPlan = rowsByPlan[option.value] || [];
      const periodKey = rowsForPlan[0] ? getPeriodKey(rowsForPlan[0]) : '';
      return {
        ...option,
        rows: rowsForPlan,
        count: rowsForPlan.length,
        periodKey,
        periodLabel: periodKey ? formatPeriodLabel(periodKey) : 'ไม่มีข้อมูล',
        codes: [...new Set(rowsForPlan.map((row) => row.p_code).filter(Boolean))]
      };
    });
  }

  const filteredRows = rows.filter((row) => getPeriodKey(row) === selectedPeriod);
  const grouped = groupRowsByPlan(filteredRows);

  return PLAN_OPTIONS.map((option) => {
    const rowsForPlan = grouped[option.value] || [];
    return {
      ...option,
      rows: rowsForPlan,
      count: rowsForPlan.length,
      periodKey: selectedPeriod,
      periodLabel: formatPeriodLabel(selectedPeriod),
      codes: [...new Set(rowsForPlan.map((row) => row.p_code).filter(Boolean))]
    };
  });
};

exports.index = async (req, res) => {
  const plans = await PbtPlan.getAll();
  const periodOptions = buildPeriodOptions(plans);
  const requestedPeriod = (req.query.period || 'latest').toString().trim() || 'latest';
  const selectedPeriod = requestedPeriod === 'latest' || periodOptions.some((option) => option.value === requestedPeriod)
    ? requestedPeriod
    : 'latest';
  const mode = selectedPeriod === 'latest' ? 'latest' : 'period';
  const sections = buildPlanSections(plans, mode, selectedPeriod);
  const summary = sections.map((section) => ({
    ...section,
    count: section.rows.length
  }));

  const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const activePeriodLabel = mode === 'latest'
    ? 'เดือนล่าสุดของแต่ละแผน'
    : (formatPeriodLabel(selectedPeriod) || '');

  res.render('pbt-plan/list', {
    title: 'CRUD pbt_plan',
    sections,
    summary,
    planOptions: PLAN_OPTIONS,
    periodOptions,
    selectedPeriod,
    activePeriodLabel,
    totalRows,
    mode
  });
};

exports.createForm = (req, res) => {
  const today = getSavedate();
  res.render('pbt-plan/create', {
    title: 'เพิ่มข้อมูล pbt_plan',
    planOptions: PLAN_OPTIONS,
    defaultMonth: today.slice(5, 7),
    defaultYear: getThaiYear(),
    defaultSavedate: today,
    defaultSaveby: getSaveBy(req),
    error: null
  });
};

exports.create = async (req, res) => {
  try {
    const rows = normalizeList(req.body.rows);
    const fileMap = getFileMap(req.files || []);
    const p_month = (req.body.p_month || '').toString().trim();
    const p_year = (req.body.p_year || '').toString().trim();
    const savedate = getSavedate();
    const saveby = getSaveBy(req);

    const items = rows
      .map((row, index) => {
        const key = row._key ?? String(index);
        const file = fileMap[`p_img_${key}`];
        const p_img = file ? file.filename : (row.p_img || '').toString().trim();

        return {
          p_plan: (row.p_plan || '').toString().trim(),
          p_month,
          p_year,
          p_code: (row.p_code || '').toString().trim(),
          p_project: (row.p_project || '').toString().trim(),
          p_img,
          p_saveby: saveby,
          p_savedate: savedate
        };
      })
      .filter((row) => row.p_plan && row.p_code && row.p_project);

    const duplicateRows = await findDuplicateRows(items);
    if (duplicateRows.length) {
      const duplicateText = [...new Set(duplicateRows.map(formatDuplicateLabel))].join(', ');
      return res.status(400).render('pbt-plan/create', {
        title: 'เพิ่มข้อมูล pbt_plan',
        planOptions: PLAN_OPTIONS,
        defaultMonth: p_month || getSavedate().slice(5, 7),
        defaultYear: p_year || getThaiYear(),
        defaultSavedate: savedate,
        defaultSaveby: saveby,
        error: `ข้อมูลเดือน/ปีนี้ซ้ำแล้ว: ${duplicateText}`
      });
    }

    if (!items.length) {
      return res.status(400).render('pbt-plan/create', {
        title: 'เพิ่มข้อมูล pbt_plan',
        planOptions: PLAN_OPTIONS,
        defaultMonth: p_month || getSavedate().slice(5, 7),
        defaultYear: p_year || getThaiYear(),
        defaultSavedate: savedate,
        defaultSaveby: saveby,
        error: 'กรุณากรอกอย่างน้อย 1 รายการให้ครบถ้วน'
      });
    }

    await PbtPlan.createMany(items);
    res.redirect('/pbt-plan');
  } catch (error) {
    console.error('Create pbt_plan error:', error);
    res.status(500).send('ไม่สามารถบันทึกข้อมูล pbt_plan ได้');
  }
};

exports.editForm = async (req, res) => {
  const plan = await PbtPlan.getById(req.params.id);
  if (!plan) {
    return res.status(404).send('ไม่พบข้อมูล pbt_plan');
  }

  res.render('pbt-plan/edit', {
    title: 'แก้ไขข้อมูล pbt_plan',
    plan,
    planOptions: PLAN_OPTIONS,
    error: null
  });
};

exports.update = async (req, res) => {
  try {
    const current = await PbtPlan.getById(req.params.id);
    if (!current) {
      return res.status(404).send('ไม่พบข้อมูล pbt_plan');
    }

    const newFile = req.file || null;
    let p_img = current.p_img;

    if (newFile) {
      removeUploadedFile(current.p_img);
      p_img = newFile.filename;
    }

    const nextRow = {
      p_plan: req.body.p_plan,
      p_month: req.body.p_month,
      p_year: req.body.p_year,
      p_code: req.body.p_code,
      p_project: req.body.p_project,
      p_img,
      p_saveby: getSaveBy(req),
      p_savedate: getSavedate()
    };

    const duplicateRows = await findDuplicateRows([nextRow], current.p_id);
    if (duplicateRows.length) {
      return res.status(400).render('pbt-plan/edit', {
        title: 'แก้ไขข้อมูล pbt_plan',
        plan: {
          ...current,
          ...req.body,
          p_img,
          p_saveby: current.p_saveby
        },
        planOptions: PLAN_OPTIONS,
        error: 'ข้อมูลเดือน/ปีนี้ซ้ำกับรายการเดิม'
      });
    }

    await PbtPlan.update(req.params.id, nextRow);

    res.redirect('/pbt-plan');
  } catch (error) {
    console.error('Update pbt_plan error:', error);
    res.status(500).send('ไม่สามารถแก้ไขข้อมูล pbt_plan ได้');
  }
};

exports.delete = async (req, res) => {
  try {
    const plan = await PbtPlan.getById(req.params.id);
    if (!plan) {
      return res.status(404).send('ไม่พบข้อมูล pbt_plan');
    }

    removeUploadedFile(plan.p_img);
    await PbtPlan.delete(req.params.id);
    res.redirect('/pbt-plan');
  } catch (error) {
    console.error('Delete pbt_plan error:', error);
    res.status(500).send('ไม่สามารถลบข้อมูล pbt_plan ได้');
  }
};
