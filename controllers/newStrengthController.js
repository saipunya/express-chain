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
  res.render('newStrength/index', { items: rows });
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
