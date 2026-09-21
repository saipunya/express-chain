const rules = require('../services/strengthAssessmentService');
const base = '/strength/assessments/public';
const common = { title:'ประเมินความเข้มแข็งด้วยตนเอง', rules, base, publicMode:true, institutions:[], item:null, submittedVersion:0, plans:[], preview:null };
function metadata(input) {
  const type = typeof input.publicType === 'string' ? input.publicType.trim() : '';
  const name = typeof input.institutionName === 'string' ? input.institutionName.trim() : '';
  const errors = {};
  if (!Object.hasOwn(rules.TYPES,type)) errors.publicType = 'เลือกประเภทสหกรณ์หรือกลุ่มเกษตรกรที่ต้องการประเมิน';
  if ((input.institutionName != null && typeof input.institutionName !== 'string') || name.length > 250) errors.institutionName = 'ชื่อสถาบันต้องเป็นข้อความไม่เกิน 250 ตัวอักษร';
  return { type, name, errors };
}
function renderForm(res, meta, args = {}, status = 200) {
  const valid = Object.keys(meta.errors).length === 0;
  return res.status(status).render('strengthAssessment/form', {
    ...common, institution: valid ? { c_code:'ประเมินด้วยตนเอง', c_name:meta.name || 'สถาบันที่ประเมิน', c_type:'' } : null,
    type: valid ? meta.type : null, publicType:meta.type, institutionName:meta.name,
    values:{ ...rules.financialDefaults({},meta.type), ...rules.organizationDefaults() }, errors:meta.errors, ...args
  });
}
exports.start = (req,res) => {
  if (!Object.keys(req.query).length) return renderForm(res,{ type:'', name:'', errors:{} }, { type:null, institution:null });
  const meta = metadata(req.query);
  return renderForm(res,meta,{},Object.keys(meta.errors).length ? 422 : 200);
};
exports.calculate = (req,res) => {
  if (!['evaluate','preview','revise'].includes(req.body.action)) return res.status(400).send('หน้าสาธารณะรองรับการคำนวณและแก้ข้อมูลเท่านั้น');
  const meta = metadata(req.body);
  if (Object.keys(meta.errors).length) return renderForm(res,meta,{},422);
  const { data, errors } = rules.normalize(req.body,meta.type);
  if (Object.keys(errors).length) return renderForm(res,meta,{ values:data, errors },422);
  if (req.body.action === 'revise') return renderForm(res,meta,{ values:data });
  const result = rules.evaluate(data,meta.type);
  if (req.body.action === 'preview') return renderForm(res,meta,{ values:data, preview:result });
  return res.render('strengthAssessment/review', {
    ...common, result, values:data, type:meta.type, publicType:meta.type, institutionName:meta.name,
    institution:{ c_code:'ประเมินด้วยตนเอง', c_name:meta.name || 'สถาบันที่ประเมิน' }
  });
};
