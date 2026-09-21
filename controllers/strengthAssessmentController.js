const rules = require('../services/strengthAssessmentService');
const base = '/strength/assessments';
const scalar = value => typeof value === 'string' ? value.trim() : '';
function actor(req) {
  const user = req.session.user;
  return { id: String(user.id || user.m_id || user.username || ''), name: String(user.fullname || user.username || 'เจ้าหน้าที่').slice(0, 250) };
}
function plansFrom(body) {
  const tasks = [], errors = {};
  for (let i = 0; i < 8; i++) {
    const task = {};
    for (const key of ['title','owner','due','status','evidence']) task[key] = scalar(body[`plan_${i}_${key}`]);
    tasks.push(task);
    if (!task.title) {
      if (task.owner || task.due || task.evidence || (task.status && task.status !== 'planned')) errors[`plan_${i}`] = 'ระบุงานที่ต้องพัฒนาสำหรับแผนที่กรอก';
      continue;
    }
    if (task.title.length > 1000 || task.owner.length > 250 || task.evidence.length > 2000) errors[`plan_${i}`] = 'ข้อความแผนยาวเกินกำหนด';
    if (task.due && !rules.validDate(task.due)) errors[`plan_${i}`] = 'วันที่กำหนดเสร็จไม่ถูกต้อง';
    if (!['planned','working','done'].includes(task.status)) errors[`plan_${i}`] = 'สถานะแผนไม่ถูกต้อง';
    if (task.status === 'done' && !task.evidence) errors[`plan_${i}`] = 'งานที่เสร็จแล้วต้องระบุหลักฐานผลสำเร็จ';
  }
  return { tasks: Object.keys(errors).length ? tasks : tasks.filter(task => task.title), errors };
}
function createController(store) {
  const common = { title: 'ประเมินและพัฒนาความเข้มแข็ง', rules, base, publicMode:false };
  async function record(req, res, editable = false) {
    if (!/^\d+$/.test(req.params.id)) { res.status(404).send('ไม่พบรายการ'); return null; }
    const item = await store.get(req.params.id);
    if (!item) { res.status(404).send('ไม่พบรายการ'); return null; }
    if (editable && String(item.owner_id) !== actor(req).id) { res.status(403).send('แก้ไขได้เฉพาะผู้บันทึกรายการนี้'); return null; }
    return item;
  }
  function form(res, args, status = 200) {
    return res.status(status).render('strengthAssessment/form', { ...common, errors: {}, item: null, values: {}, plans: [], preview: null, submittedVersion: args.item?.version || 0, ...args });
  }
  return {
    async index(req,res) {
      const search = scalar(req.query.search).slice(0,150);
      const page = Math.min(Math.max(parseInt(req.query.page,10) || 1,1),100000);
      const data = await store.list({ search, page });
      res.render('strengthAssessment/index', { ...common, ...data, search, page });
    },
    async create(req,res) {
      const code = scalar(req.query.code);
      const institutions = await store.institutions();
      const institution = code ? await store.institution(code) : null;
      if (code && !institution) return res.status(404).send('ไม่พบสถาบันในทะเบียน');
      const type = institution ? rules.institutionType(institution) : null;
      const errors = institution && !type ? { institution: 'ข้อมูลประเภทสถาบันในทะเบียนไม่ชัดเจน กรุณาปรับทะเบียนก่อนเลือกเกณฑ์' } : {};
      form(res, { institutions, institution, type, errors, values: { ...rules.financialDefaults(institution, type), ...rules.organizationDefaults() } });
    },
    async detail(req,res) {
      const item = await record(req,res);
      if (!item) return;
      res.render('strengthAssessment/detail', { ...common, item, canEdit: String(item.owner_id) === actor(req).id, history: await store.history(item.id) });
    },
    async edit(req,res) {
      const item = await record(req,res,true);
      if (!item) return;
      form(res, { item, institutions: [], institution: item.document.institution, type: item.institution_type, values: { ...rules.financialDefaults(item.document.institution,item.institution_type), ...rules.organizationDefaults(), dimension2Mode: 'upstream', dimension3Mode: 'upstream', ...item.document.answers }, plans: item.document.plans || [] });
    },
    async save(req,res) {
      const item = req.params.id ? await record(req,res,true) : null;
      if (req.params.id && !item) return;
      const institution = item ? item.document.institution : await store.institution(scalar(req.body.code));
      if (!institution) return res.status(400).send('เลือกสถาบันในทะเบียนก่อนบันทึก');
      const type = item ? item.institution_type : rules.institutionType(institution);
      if (!type) return res.status(400).send('ประเภทสถาบันไม่ชัดเจน กรุณาตรวจทะเบียน');
      const body = { ...req.body };
      for (const mode of ['dimension2Mode','dimension3Mode']) {
        if (item && item.document.answers[mode] == null && body[mode] == null) body[mode] = 'upstream';
      }
      const { data, errors } = rules.normalize(body,type,institution);
      const { tasks, errors: planErrors } = plansFrom(req.body);
      Object.assign(errors, planErrors);
      if (item && Number(req.body.version) !== Number(item.version)) errors.version = 'รายการถูกแก้ไขระหว่างที่เปิดหน้านี้ กรุณาเปิดรายการล่าสุดก่อนบันทึก';
      if (Object.keys(errors).length) return form(res, { item, institutions: [], institution, type, values: data, plans: tasks, submittedVersion: scalar(req.body.version), errors }, 422);
      if (req.body.action === 'revise') return form(res, { item, institutions: [], institution, type, values: data, plans: tasks });
      const result = rules.evaluate(data,type);
      if (req.body.action === 'evaluate') return res.render('strengthAssessment/review', { ...common, item, institution, type, values:data, plans:tasks, result, submittedVersion:item?.version || 0 });
      if (req.body.action === 'preview') return form(res, { item, institutions: [], institution, type, values: data, plans: tasks, preview: result });
      if (req.body.action !== 'save') return res.status(400).send('คำสั่งไม่ถูกต้อง');
      const document = { institution, answers: data, result, plans: tasks, ruleVersion: rules.RULE_VERSION, assessmentYear: 2569, classificationBasisYear: 2568 };
      try {
        const id = await store.save({ id: item?.id, version: item ? Number(req.body.version) : 0, institution, type, actor: actor(req), document });
        res.redirect(303, `${base}/${id}`);
      } catch (error) {
        if (error.status === 409) return form(res, { item, institutions: [], institution, type, values: data, plans: tasks, submittedVersion: scalar(req.body.version), errors: { save: error.message } },409);
        throw error;
      }
    }
  };
}
module.exports = { createController, plansFrom };
