const { normalize, evaluate } = require('../../services/strengthAssessmentService');
const institutions = [
  { c_code:'TEST-001', c_name:'สหกรณ์การเกษตรตัวอย่าง จำกัด', coop_group:'สหกรณ์', in_out_group:'ใน', c_type:'สหกรณ์การเกษตร', c_status:'ดำเนินการ', c_group:'กลุ่มส่งเสริม 1' },
  { c_code:'TEST-002', c_name:'สหกรณ์ออมทรัพย์ตัวอย่าง จำกัด', coop_group:'สหกรณ์', in_out_group:'นอก', c_type:'สหกรณ์ออมทรัพย์', c_status:'ดำเนินการ', c_group:'กลุ่มส่งเสริม 2' },
  { c_code:'TEST-003', c_name:'กลุ่มเกษตรกรทำนาตัวอย่าง', coop_group:'กลุ่มเกษตรกร', in_out_group:'', c_type:'ทำนา', c_status:'ดำเนินการ', c_group:'กลุ่มส่งเสริม 3' }
];
function answers(type='agri', overrides={}) {
  return { eligible:'yes', eligibilityNote:'ทะเบียนปี 2569 ดำเนินการครบสองรอบบัญชี', fiscalEnd:'2026-03-31', closed:'yes', meetingHeld:'yes', statementsPresented:'yes', basicEvidence:'รายงานประชุมและงบปีบัญชี 2569', members:'1000', participating:'900', savings:'yes', allocation:type==='farmer'?'both':'high', businesses:'6', memberEvidence:'ทะเบียนสมาชิกและรายงานการจ่ายทุนย้อนหลังสองปี', dimension2Mode:'upstream', dimension2:'20', dimension3Mode:'upstream', dimension3:'20', controlMode:'standard', cadEvidence:'ผลประเมินต้นทางปี 2569', defects:'clear', profit:'both', receivedDate:'2026-04-30', meetingDate:'2026-08-28', audited:'yes', staff:'permanent', exception:'no', managementEvidence:'รายงานผู้สอบบัญชีและข้อบกพร่อง ณ 31 ส.ค. 2569', ...overrides };
}
function createMemoryStore() {
  const records=new Map(), revisions=new Map(); let sequence=0;
  return {
    institutions:async()=>institutions,
    institution:async code=>institutions.find(i=>i.c_code===code)||null,
    list:async({search='',page=1}={})=>{ const items=[...records.values()].filter(i=>i.institution_name.includes(search)||i.c_code.includes(search));return {total:items.length,items:items.slice((page-1)*30,page*30)}; },
    get:async id=>records.get(String(id))||null,
    history:async id=>revisions.get(String(id))||[],
    save:async({id,version,institution,type,actor,document})=>{
      const existing=id?records.get(String(id)):null;
      if (existing && (existing.version!==version || existing.owner_id!==actor.id)) throw Object.assign(new Error('ข้อมูลเปลี่ยนแล้ว'),{status:409});
      if (!id && [...records.values()].some(r=>r.c_code===institution.c_code)) throw Object.assign(new Error('มีรายการแล้ว'),{status:409});
      id=String(id||++sequence);
      const row={id,c_code:institution.c_code,institution_name:institution.c_name,institution_type:type,assessment_year:2569,owner_id:actor.id,owner_name:actor.name,version:existing?existing.version+1:1,document:structuredClone(document)};
      records.set(id,row);
      revisions.set(id,[{version:row.version,actor_name:actor.name,created_at:new Date()},...(revisions.get(id)||[])]);
      return id;
    },
    seed:async function(type='agri', overrides={}) {
      const institution=institutions[{agri:0,non_agri:1,farmer:2}[type]],data=normalize(answers(type,overrides),type).data;
      return this.save({institution,type,actor:{id:'1',name:'เจ้าหน้าที่ตัวอย่าง'},document:{institution,answers:data,result:evaluate(data,type),plans:[],ruleVersion:require('../../services/strengthAssessmentService').RULE_VERSION}});
    }
  };
}
module.exports={answers,institutions,createMemoryStore};
