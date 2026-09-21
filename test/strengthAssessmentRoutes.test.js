process.env.DB_SKIP_STARTUP_CHECK='1';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),session=require('express-session'),path=require('path');
const {createRouter}=require('../routes/strengthAssessmentRouter');
const {createMemoryStore,answers}=require('./helpers/strengthAssessmentFixture');
const {financialAnswers}=require('./helpers/strengthFinancialFixture');
const {organizationAnswers}=require('./helpers/strengthOrganizationFixture');
const db=require('../config/db');
let server,origin;const store=createMemoryStore();
test.before(async()=>{
  const app=express();app.set('view engine','ejs');app.set('views',path.join(__dirname,'../views'));app.use(express.urlencoded({extended:true}));app.use(session({secret:'test-strength-session',resave:false,saveUninitialized:false}));
  // Test-only authentication. This app is never mounted by production routes.
  app.get('/test-login',(req,res)=>{req.session.user={id:req.query.id||'1',username:'tester',fullname:'เจ้าหน้าที่ทดสอบ',group:req.query.group||'cpd'};res.send('ok');});
  app.use((req,res,next)=>{res.locals.user=req.session.user||null;res.locals.title='Test';next();});
  app.use('/strength/assessments',createRouter(store));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin=`http://127.0.0.1:${server.address().port}`;
});
test.after(async()=>{if (server) await new Promise(r=>server.close(r));await db.end();});
async function login(query='') {const response=await fetch(origin+'/test-login'+query);return response.headers.get('set-cookie').split(';')[0];}
async function get(route,cookie) {return fetch(origin+route,{headers:cookie?{cookie}:{},redirect:'manual'});}
async function post(route,cookie,body) {return fetch(origin+route,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'});}
test('authentication and institution restrictions apply to all new pages',async()=>{
  assert.equal((await get('/strength/assessments')).status,302);
  const cookie=await login('?group=coop');assert.equal((await get('/strength/assessments',cookie)).status,403);
});
test('preview, persistence, rendering, plans, ownership and revision conflict work end to end',async()=>{
  const cookie=await login();
  const form=await (await get('/strength/assessments/new?code=TEST-001',cookie)).text();assert.match(form,/สหกรณ์การเกษตรตัวอย่าง/);
  const token=form.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const body={...answers(),code:'TEST-001',_csrf:token,action:'preview',version:'0'};
  let response=await post('/strength/assessments',cookie,body);assert.equal(response.status,200);assert.match(await response.text(),/ชั้น 1 · จำลอง/);assert.equal((await store.list()).total,0);
  response=await post('/strength/assessments',cookie,{...body,_csrf:'é'.repeat(64),action:'save'});assert.equal(response.status,403);
  response=await post('/strength/assessments',cookie,{...body,dimension2:'999',action:'save'});assert.equal(response.status,422);assert.equal((await store.list()).total,0);
  response=await post('/strength/assessments',cookie,{...body,action:'save',plan_0_title:'ทบทวนบัญชี',plan_0_status:'working',plan_0_owner:'เจ้าหน้าที่ ก.'});assert.equal(response.status,303);
  const route=response.headers.get('location');assert.match(await (await get(route,cookie)).text(),/ทบทวนบัญชี/);
  assert.match(await (await get('/strength/assessments',cookie)).text(),/สหกรณ์การเกษตรตัวอย่าง/);
  response=await post(route,cookie,{...body,action:'save',version:'1',dimension2:''});assert.equal(response.status,303);assert.equal((await store.get('1')).document.result.status,'draft');assert.equal((await store.history('1')).length,2);
  response=await post(route,cookie,{...body,action:'save',version:'1'});assert.equal(response.status,422);assert.match(await response.text(),/name="version" value="1"/);assert.equal((await store.get('1')).version,2);
  const stranger=await login('?id=2');assert.equal((await get(route+'/edit',stranger)).status,403);assert.equal((await get(route,stranger)).status,200);
});
test('farmer pending rules and user-supplied HTML are rendered as safe text',async()=>{
  const cookie=await login();const html=await (await get('/strength/assessments/new?code=TEST-003',cookie)).text();const token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const res=await post('/strength/assessments',cookie,{...answers('farmer',{allocation:'previous',memberEvidence:'<script>alert(1)</script>'}),code:'TEST-003',action:'preview',_csrf:token});const text=await res.text();assert.equal(res.status,200);assert.match(text,/รอคำชี้แจง/);assert.match(text,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.doesNotMatch(text,/<script>alert\(1\)/);
});
test('financial preview, saving and edits use server calculation and preserve raw data',async()=>{
  const cookie=await login();
  const html=await (await get('/strength/assessments/new?code=TEST-002',cookie)).text();
  assert.match(html,/คำนวณจากข้อมูลทางการเงิน/);assert.match(html,/name="assets"/);
  const token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const body={...answers('non_agri'),...financialAnswers({financialSubtype:'savings',reserve:'0',dimension2:'20'}),code:'TEST-002',_csrf:token,action:'preview',version:'0'};
  let response=await post('/strength/assessments',cookie,body);assert.equal(response.status,200);
  let text=await response.text();assert.match(text,/ผลคำนวณอัตราส่วนทางการเงิน/);assert.match(text,/ทุนสำรองเป็นศูนย์/);assert.match(text,/98\.00/);
  response=await post('/strength/assessments',cookie,{...body,financialSubtype:'service',action:'save'});assert.equal(response.status,422);
  response=await post('/strength/assessments',cookie,{...body,action:'save',financialEvidence:'<script>bad</script>'});assert.equal(response.status,303);
  const route=response.headers.get('location'),id=route.split('/').pop(),item=await store.get(id);
  assert.equal(item.document.answers.dimension2,undefined);assert.equal(item.document.answers.reserve,'0');assert.equal(item.document.result.financial.total,18);assert.equal(item.document.result.total,98);
  text=await (await get(route,cookie)).text();assert.match(text,/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(text,/ผลคำนวณอัตราส่วนทางการเงิน/);
  text=await (await get(route+'/edit',cookie)).text();assert.match(text,/name="reserve" value="0"/);
  response=await post(route,cookie,{...body,action:'save',version:'1',reserve:'300000'});assert.equal(response.status,303);
  assert.equal((await store.get(id)).document.result.total,100);assert.equal((await store.history(id)).length,2);
});
test('editing an actual legacy document keeps its upstream mode and evidence',async()=>{
  const cookie=await login(),item=await store.get('1');
  delete item.document.answers.dimension2Mode;delete item.document.answers.dimension3Mode;item.document.answers.dimension2=20;
  item.document.result=require('../services/strengthAssessmentService').evaluate(item.document.answers,'agri');
  const text=await (await get('/strength/assessments/1/edit',cookie)).text();assert.match(text,/value="upstream" selected/);
  const token=text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const body={...answers(),code:'TEST-001',_csrf:token,action:'preview',version:String(item.version)};delete body.dimension2Mode;delete body.dimension3Mode;
  const response=await post('/strength/assessments/1',cookie,body);assert.equal(response.status,200);assert.match(await response.text(),/100\.00/);
});
test('standard dimension 3 previews individual areas, saves them, and changes mode safely',async()=>{
  const cookie=await login(),old=await store.get('1'),oldVersion=old.version;
  const html=await (await get('/strength/assessments/1/edit',cookie)).text();
  const token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const body={...answers(),...organizationAnswers({controlEnvironmentLevel:'none',controlRiskLevel:'low',controlInformationLevel:'middle',controlMonitoringLevel:'high'}),_csrf:token,code:'TEST-001',version:String(oldVersion),action:'preview'};
  let response=await post('/strength/assessments/1',cookie,body);assert.equal(response.status,200);
  let text=await response.text();assert.match(text,/คะแนนการจัดการองค์กรแยกองค์ประกอบ/);assert.match(text,/0 ÷ 3 × 4/);assert.match(text,/1 ÷ 3 × 4/);assert.match(text,/92\.00/);
  response=await post('/strength/assessments/1',cookie,{...body,action:'save',controlRiskLevel:'invalid'});assert.equal(response.status,422);assert.equal((await store.get('1')).version,oldVersion);
  response=await post('/strength/assessments/1',cookie,{...body,action:'save',dimension3:'999'});assert.equal(response.status,303);
  const saved=await store.get('1');assert.equal(saved.document.result.organization.total,12);assert.equal(saved.document.answers.dimension3,undefined);assert.equal(saved.document.answers.controlRiskLevel,'low');assert.equal(old.document.answers.dimension3,20);
  text=await (await get('/strength/assessments/1',cookie)).text();assert.match(text,/คะแนนการจัดการองค์กรแยกองค์ประกอบ/);
  text=await (await get('/strength/assessments/1/edit',cookie)).text();assert.match(text,/value="low" selected/);
  response=await post('/strength/assessments/1',cookie,{...body,version:String(saved.version),action:'save',controlMode:'overall',controlOverall:'middle',controlRiskLevel:'invalid'});assert.equal(response.status,303);
  const overall=await store.get('1');assert.equal(overall.document.result.organization.rows.length,2);assert.equal(overall.document.answers.controlRiskLevel,undefined);assert.equal(overall.document.result.organization.total,14.67);
});
test('farmer standard form excludes technology and calculates scores from 0–100 results',async()=>{
  const cookie=await login(),html=await (await get('/strength/assessments/new?code=TEST-003',cookie)).text();
  assert.doesNotMatch(html,/name="accountingTechnology"/);assert.match(html,/name="controlEnvironmentPercent"/);
  const token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const body={...answers('farmer'),...organizationAnswers({controlInput:'percent',controlEnvironmentPercent:'95',controlRiskPercent:'80',controlInformationPercent:'60',controlMonitoringPercent:'100'}),code:'TEST-003',_csrf:token,action:'preview'};
  let response=await post('/strength/assessments',cookie,body);assert.equal(response.status,200);const text=await response.text();assert.match(text,/95\.00 \/ 100/);assert.match(text,/2 ÷ 3 × 5/);assert.match(text,/90\.00/);
  response=await post('/strength/assessments',cookie,{...body,controlEnvironmentPercent:'100.01'});assert.equal(response.status,422);
});
test('user input flows through a read-only result, revision and save without losing data or plans',async()=>{
  const cookie=await login(),old=await store.get('1'),version=old.version;
  const html=await (await get('/strength/assessments/1/edit',cookie)).text();
  assert.match(html,/ประเมินผลและดูคำแนะนำส่งเสริม/);
  const token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  const evidence='รายงาน "ส่งเสริม" <ทดสอบ> & เอกสาร';
  const body={...answers(),...financialAnswers({reserve:'0'}),...organizationAnswers({controlRiskLevel:'none'}),code:'TEST-001',_csrf:token,version:String(version),action:'evaluate',cadEvidence:evidence,plan_0_title:'ติดตามงาน',plan_0_status:'working',plan_0_owner:'ผู้รับผิดชอบ'};
  let response=await post('/strength/assessments/1',cookie,body);assert.equal(response.status,200);
  let text=await response.text();assert.match(text,/ผลประเมินและคำแนะนำส่งเสริม/);assert.match(text,/ยังไม่ได้บันทึกผล/);assert.match(text,/ทุนสำรอง/);assert.match(text,/ความเสี่ยงและกิจกรรมควบคุม/);
  assert.ok(text.indexOf('ข้อที่ควรส่งเสริมและพัฒนา')<text.indexOf('คะแนนรายตัวชี้วัด'));
  assert.equal((await store.get('1')).version,version);
  const entities={'&amp;':'&','&lt;':'<','&gt;':'>','&#34;':'"','&#39;':"'",'&quot;':'"'};
  const decode=value=>value.replace(/&(?:amp|lt|gt|quot);|&#(?:34|39);/g,entity=>entities[entity]);
  const hidden=Object.fromEntries([...text.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map(([,key,value])=>[decode(key),decode(value)]));
  assert.equal(hidden.cadEvidence,evidence);assert.equal(hidden.plan_0_owner,'ผู้รับผิดชอบ');assert.equal(hidden.dimension3,undefined);
  response=await post('/strength/assessments/1',cookie,{...hidden,action:'revise'});assert.equal(response.status,200);text=await response.text();assert.match(text,/id="assessment-form"/);assert.match(text,/value="0"/);assert.match(text,/ติดตามงาน/);assert.equal((await store.get('1')).version,version);
  response=await post('/strength/assessments/1',cookie,{...hidden,action:'save',total:'100',grade:'1'});assert.equal(response.status,303);
  const saved=await store.get('1');assert.equal(saved.version,version+1);assert.equal(saved.document.result.total,94);assert.equal(saved.document.answers.cadEvidence,evidence);assert.equal(saved.document.plans[0].title,'ติดตามงาน');
  response=await post('/strength/assessments/1',cookie,{...hidden,action:'save'});assert.equal(response.status,422);
});
test('incomplete input and a fully passing result have distinct promotion guidance',async()=>{
  const cookie=await login(),form=await (await get('/strength/assessments/new?code=TEST-003',cookie)).text();
  const token=form.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  let response=await post('/strength/assessments',cookie,{code:'TEST-003',_csrf:token,action:'evaluate'});assert.equal(response.status,200);let text=await response.text();assert.match(text,/ยังสรุปการผ่านเกณฑ์ไม่ได้/);assert.match(text,/บันทึกฉบับร่าง/);assert.doesNotMatch(text,/ชั้น 3 · จำลอง/);
  response=await post('/strength/assessments',cookie,{...answers('farmer'),code:'TEST-003',_csrf:token,action:'evaluate'});assert.equal(response.status,200);text=await response.text();assert.match(text,/ผ่านเงื่อนไขการจัดชั้นเป้าหมาย/);assert.match(text,/รักษาระบบงานและหลักฐาน/);
});
