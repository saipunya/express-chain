const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../services/strengthAssessmentService');
const {answers}=require('./helpers/strengthAssessmentFixture');
const {plansFrom}=require('../controllers/strengthAssessmentController');
test('promotion advice includes delayed financial statements even when class gates pass',()=>{
  const {data,errors}=rules.normalize(answers('agri',{receivedDate:'2026-05-31'}),'agri');assert.deepEqual(errors,{});
  const result=rules.evaluate(data,'agri');assert.equal(result.grade,1);assert.ok(result.recommendations.some(r=>r.key==='improve-4.3'));
});
function assess(type='agri',overrides={}) { const {data,errors}=rules.normalize(answers(type,overrides),type);assert.deepEqual(errors,{});return rules.evaluate(data,type); }
function score(result,id) {return result.scores.find(s=>s.id===id).value;}
for (const type of ['agri','non_agri','farmer']) test(`${type}: complete maximum is 100 with provisional class 1`,()=>{
  const r=assess(type);assert.equal(r.total,100);assert.equal(r.grade,1);assert.equal(r.status,'preliminary');assert.match(r.version,/provisional/);
});
test('82 agricultural points still class 2 when mandatory defect condition fails',()=>{
  const r=assess('agri',{defects:'resolved',dimension2:'7'});assert.equal(r.total,82);assert.equal(r.grade,2);assert.equal(r.gates.find(g=>g.key==='defect1').passed,false);assert.ok(r.recommendations.some(r=>r.key==='defect1'));
});
test('high scores do not override failure of the basic meeting condition',()=>{
  const r=assess('agri',{meetingHeld:'no',meetingDate:'',statementsPresented:'no'});assert.equal(r.grade,3);assert.ok(r.recommendations.some(r=>r.priority===1));
});
test('control overall prevents class 1 even with maximum total',()=>assert.equal(assess('agri',{controlMode:'overall'}).grade,2));
test('non-agriculture cannot pass class 2 with zero dimension 3',()=>assert.equal(assess('non_agri',{dimension3:'0'}).grade,3));
test('farmer class 1 uses explicitly labelled previous-year mean',()=>{
  const r=assess('farmer',{dimension2:'14'});assert.equal(r.total,94);assert.equal(r.grade,2);assert.match(r.gates.find(g=>g.key==='business1').label,/2568/);
});
test('missing score stays unknown and cannot receive a class',()=>{
  const r=assess('agri',{dimension2:''});assert.equal(r.total,null);assert.equal(score(r,'2'),null);assert.equal(r.grade,null);assert.equal(r.status,'draft');
});
test('missing provenance prevents a completed result even if numeric total is 100',()=>{
  const r=assess('agri',{cadEvidence:''});assert.equal(r.total,100);assert.equal(r.grade,null);assert.equal(r.status,'draft');
});
test('unknown auditing status does not silently produce 1 point',()=>assert.equal(score(assess('agri',{audited:''}),'4.3'),null));
test('excluded institutions are not classified as class 3',()=>{
  const r=rules.evaluate(rules.normalize({eligible:'no',eligibilityNote:'ยังไม่ครบสองรอบบัญชี'},'agri').data,'agri');assert.equal(r.status,'excluded');assert.equal(r.grade,null);
});
test('farmer ambiguous allocation and late receipts require review',()=>{
  for (const override of [{allocation:'previous'},{receivedDate:'2026-06-30'},{exception:'yes'}]) { const r=assess('farmer',override);assert.equal(r.status,'review');assert.equal(r.grade,null);assert.ok(r.issues.length); }
});
test('exception never silently awards points',()=>{ const r=assess('agri',{profit:'exception'});assert.equal(score(r,'4.2'),null);assert.equal(r.grade,null); });
for (const [date,points] of [['2026-04-30',5],['2026-05-01',4],['2026-05-30',4],['2026-05-31',2],['2026-06-29',2],['2026-06-30',0]]) test(`cooperative receipt ${date} has ${points} points`,()=>assert.equal(score(assess('agri',{receivedDate:date}),'4.3'),points));
test('meeting day 150 vs 151 is evaluated from actual dates',()=>{
  assert.equal(score(assess('agri',{meetingDate:'2026-08-28'}),'4.3'),5);
  assert.equal(score(assess('agri',{meetingDate:'2026-08-29'}),'4.3'),1);
  assert.equal(score(assess('farmer',{meetingDate:'2026-08-29'}),'4.3'),0);
});
test('membership uses strict greater-than boundaries and actionable target',()=>{
  assert.equal(score(assess('agri',{participating:'800'}),'1.1'),12);
  assert.equal(score(assess('agri',{participating:'801'}),'1.1'),15);
  assert.match(assess('agri',{participating:'780'}).recommendations.find(r=>r.key==='members').detail,/เพิ่ม 21 คน/);
  assert.equal(score(assess('non_agri',{participating:'850'}),'1.1'),12);
  assert.equal(score(assess('non_agri',{participating:'851'}),'1.1'),15);
});
test('different business weights for agricultural cooperatives and farmer groups',()=>{
  assert.equal(score(assess('agri',{businesses:'3'}),'1.3'),1);assert.equal(score(assess('farmer',{businesses:'3'}),'1.3'),3);
});
for (const override of [{members:'0'},{members:'1.5'},{participating:'1001'},{dimension2:'21'},{dimension3:'NaN'},{dimension2:'1e1'},{dimension2:['10']},{fiscalEnd:'2026-02-30'},{fiscalEnd:'2569-03-31'},{fiscalEnd:'2026-04-01'},{receivedDate:'2026-03-30'},{meetingHeld:'no'},{closed:'no'},{receivedDate:'2026-09-01'}]) test(`invalid input rejected ${JSON.stringify(override)}`,()=>assert.ok(Object.keys(rules.normalize(answers('agri',override),'agri').errors).length));
test('institution classification accepts both known agricultural representations and rejects unknown',()=>{
  for(const in_out_group of ['ใน','ภาคการเกษตร','ในภาคการเกษตร'])assert.equal(rules.institutionType({coop_group:'สหกรณ์',in_out_group}),'agri');
  assert.equal(rules.institutionType({coop_group:'สหกรณ์',in_out_group:''}),null);
  assert.equal(rules.institutionType({coop_group:'กลุ่มเกษตรกร'}),'farmer');
});
test('completed plans require evidence; invalid plan text is retained',()=>{
  const bad=plansFrom({plan_0_owner:'ผู้รับผิดชอบ',plan_0_status:'working'});assert.ok(bad.errors.plan_0);assert.equal(bad.tasks[0].owner,'ผู้รับผิดชอบ');
  assert.ok(plansFrom({plan_0_title:'ปิดบัญชี',plan_0_status:'done'}).errors.plan_0);
  const good=plansFrom({plan_0_title:'ปิดบัญชี',plan_0_status:'done',plan_0_evidence:'เลขหนังสือ 1/2569'});assert.deepEqual(good.errors,{});assert.equal(good.tasks.length,1);
});
for (const [type,minimum,overrides] of [
  ['agri',55,{defects:'resolved',profit:'current',dimension2:'2',dimension3:'0'}],
  ['non_agri',65,{defects:'resolved',profit:'current',dimension2:'11.99',dimension3:'0.01'}],
  ['farmer',65,{allocation:'current',businesses:'3',dimension2:'10',dimension3:'5',defects:'follow',receivedDate:'2026-05-15'}]
]) test(`${type}: class 2 includes exact ${minimum} boundary`,()=>{const r=assess(type,overrides);assert.equal(r.total,minimum);assert.equal(r.grade,2);const below=assess(type,{...overrides,dimension2:String(Number(overrides.dimension2)-.01)});assert.equal(below.grade,3);});
test('class 1 exact 80 and 85 thresholds',()=>{
  assert.equal(assess('agri',{dimension2:'0'}).grade,1);
  assert.equal(assess('agri',{dimension2:'0',dimension3:'19.99'}).grade,2);
  assert.equal(assess('farmer',{dimension2:'15',dimension3:'10'}).grade,1);
  const below=assess('farmer',{dimension2:'15.99',dimension3:'10',staff:'temporary'});assert.equal(below.total,84.99);assert.equal(below.grade,2);
});
