const db = require('../config/db');
const NewStrength = require('../models/newStrength');

const getUserName = (req) => req?.session?.user?.username || req?.session?.user?.fullname || 'system';
const today = () => new Date().toISOString().slice(0, 10);

// Helpers to fetch coop groups/codes
const fetchGroups = async () => {
  const [rows] = await db.query(
    `SELECT DISTINCT c_group
     FROM active_coop
     WHERE c_status = 'ดำเนินการ'
       AND c_group IS NOT NULL
       AND c_group <> ''
     ORDER BY c_group`
  );
  return rows.map((r) => r.c_group);
};

const fetchCodesByGroup = async (group) => {
  if (!group) return [];
  const [rows] = await db.query(
    `SELECT c_code, c_name, c_group
     FROM active_coop
     WHERE c_status = 'ดำเนินการ'
       AND c_group = ?
     ORDER BY c_name`,
    [group]
  );
  return rows;
};

exports.index = async (req, res) => {
  const [rows] = await db.query(
    `SELECT ns.*, ac.c_name, ac.c_group
     FROM new_strength ns
     LEFT JOIN active_coop ac ON ac.c_code = ns.str_code
     ORDER BY ns.str_id DESC`
  );

  // สรุปข้อมูลแยกตามประเภทสหกรณ์ (สหกรณ์ภาคการเกษตร, นอกภาคการเกษตร, กลุ่มเกษตรกร)
  const [summaryRows] = await db.query(`
    SELECT
      CASE
        WHEN ac.coop_group = 'กลุ่มเกษตรกร' THEN 'กลุ่มเกษตรกร'
        WHEN REPLACE(TRIM(COALESCE(ac.in_out_group,'')), CHAR(160), '') = 'ใน' THEN 'สหกรณ์ภาคการเกษตร'
        ELSE 'สหกรณ์นอกภาคการเกษตร'
      END AS coop_type,
      SUM(CASE WHEN ns.str_grade = 'ชั้น1' THEN 1 ELSE 0 END) AS grade_1_count,
      SUM(CASE WHEN ns.str_grade = 'ชั้น2' THEN 1 ELSE 0 END) AS grade_2_count,
      SUM(CASE WHEN ns.str_grade = 'ชั้น3' THEN 1 ELSE 0 END) AS grade_3_count,
      COUNT(ns.str_id) AS total_count
    FROM new_strength ns
    LEFT JOIN active_coop ac ON ac.c_code = ns.str_code
    WHERE ac.c_status = 'ดำเนินการ'
    GROUP BY coop_type
  `);

  const summaryMap = {};
  summaryRows.forEach(r => {
    summaryMap[r.coop_type] = r;
  });

  const summaryTypes = ['สหกรณ์ภาคการเกษตร', 'สหกรณ์นอกภาคการเกษตร', 'กลุ่มเกษตรกร'];
  const formattedSummary = summaryTypes.map(type => {
    const data = summaryMap[type] || { grade_1_count: 0, grade_2_count: 0, grade_3_count: 0, total_count: 0 };
    return {
      typeLabel: type,
      counts: {
        'ชั้น1': Number(data.grade_1_count) || 0,
        'ชั้น2': Number(data.grade_2_count) || 0,
        'ชั้น3': Number(data.grade_3_count) || 0
      },
      total: Number(data.total_count) || 0
    };
  });

  res.render('newStrength/index', { 
    items: rows,
    summary: formattedSummary
  });
};

exports.create = async (req, res) => {
  const groups = await fetchGroups();
  const selectedGroup = req.query.group || groups[0] || '';
  const codes = await fetchCodesByGroup(selectedGroup);
  res.render('newStrength/create', {
    groups,
    codes,
    selectedGroup,
    selectedCode: '',
    str_grade: '',
    selectedGrade: '',
    error: null,
  });
};

exports.store = async (req, res) => {
  const payload = {
    str_code: req.body.str_code || '',
    str_group: req.body.str_group || '',
    str_grade: req.body.str_grade || '',
    str_saveby: getUserName(req),
    str_savedate: today(),
  };
  const duplicate = await NewStrength.findByCode(payload.str_code);
  if (duplicate) {
    const groups = await fetchGroups();
    const selectedGroup = payload.str_group || groups[0] || '';
    const codes = await fetchCodesByGroup(selectedGroup);
    return res.status(400).render('newStrength/create', {
      groups,
      codes,
      selectedGroup,
      selectedCode: payload.str_code,
      str_grade: payload.str_grade,
      selectedGrade: payload.str_grade,
      error: 'มีรหัสนี้แล้วในระบบ'
    });
  }
  await NewStrength.create(payload);
  res.redirect('/newstrength');
};

exports.edit = async (req, res) => {
  const item = await NewStrength.findByPk(req.params.id);
  if (!item) return res.status(404).send('ไม่พบข้อมูล');

  const groups = await fetchGroups();
  const selectedGroup = item.str_group || groups[0] || '';
  const codes = await fetchCodesByGroup(selectedGroup);

  res.render('newStrength/edit', {
    item,
    groups,
    codes,
    selectedGroup,
    selectedCode: item.str_code,
    str_grade: item.str_grade,
  });
};

exports.update = async (req, res) => {
  const payload = {
    str_code: req.body.str_code || '',
    str_group: req.body.str_group || '',
    str_grade: req.body.str_grade || '',
    str_saveby: getUserName(req),
    str_savedate: today(),
  };
  await NewStrength.update(req.params.id, payload);
  res.redirect('/newstrength');
};

exports.destroy = async (req, res) => {
  await NewStrength.destroy(req.params.id);
  res.redirect('/newstrength');
};

// Ajax: get codes by group
exports.codesByGroup = async (req, res) => {
  const group = req.query.group || '';
  const codes = await fetchCodesByGroup(group);
  res.json(codes);
};
