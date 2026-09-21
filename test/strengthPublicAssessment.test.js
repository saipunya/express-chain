process.env.DB_SKIP_STARTUP_CHECK='1';
const test=require('node:test'), assert=require('node:assert/strict'), express=require('express'), session=require('express-session'), path=require('path');
const {createRouter}=require('../routes/strengthAssessmentRouter');
const {redirectInstitutionUsers}=require('../middlewares/authMiddleware');
const {answers}=require('./helpers/strengthAssessmentFixture');
const {financialAnswers}=require('./helpers/strengthFinancialFixture');
const {organizationAnswers}=require('./helpers/strengthOrganizationFixture');
const db=require('../config/db');
const base='/strength/assessments/public';
let server,origin,storeCalls=0;
test.before(async()=>{
  const app=express();app.set('view engine','ejs');app.set('views',path.join(__dirname,'../views'));app.use(express.urlencoded({extended:true}));
  app.use(session({secret:'test-public-strength-only',resave:false,saveUninitialized:false}));
  app.get('/test/session',(req,res)=>res.json(req.session));
  app.get('/test/institution-login',(req,res)=>{req.session.user={id:'9',username:'TEST-009',group:req.query.group||'coop',mClass:req.query.mClass};res.send('ok');});
  app.use(redirectInstitutionUsers);
  // Any attempt to list/read/write private assessments or the institution registry fails the test.
  const forbiddenStore=new Proxy({}, {get:()=>async()=>{storeCalls++;throw new Error('Public page accessed private storage');}});
  app.use('/strength/assessments',createRouter(forbiddenStore));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin=`http://127.0.0.1:${server.address().port}`;
});
test.after(async()=>{if(server) await new Promise(r=>server.close(r));await db.end();assert.equal(storeCalls,0);});
const get=(route,cookie)=>fetch(origin+route,{headers:cookie?{cookie}:{},redirect:'manual'});
const post=(route,cookie,body)=>fetch(origin+route,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),redirect:'manual'});
const decode=value=>value.replace(/&(?:amp|lt|gt|quot);|&#(?:34|39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#34;':'"','&#39;':"'"})[s]);
const hidden=html=>Object.fromEntries([...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map(([,k,v])=>[decode(k),decode(v)]));
async function start(type='agri',name='สถาบันทดสอบ') {
  const response=await get(`${base}/new?publicType=${type}&institutionName=${encodeURIComponent(name)}`);
  const cookie=response.headers.get('set-cookie').split(';')[0],html=await response.text();
  assert.equal(response.status,200);
  return {cookie,html,token:html.match(/name="_csrf" value="([a-f0-9]+)"/)[1]};
}
test('anonymous entry works without exposing a registry or requiring login',async()=>{
  const response=await get(base);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const html=await response.text();assert.match(html,/ไม่ต้องเข้าสู่ระบบ/);assert.match(html,/name="publicType"/);assert.doesNotMatch(html,/name="code"/);
  const root=await get('/strength/assessments');assert.equal(root.status,302);assert.equal(root.headers.get('location'),base);
});
for (const [type,subtype] of [['agri','agriculture'],['non_agri','savings'],['farmer','farmer']]) test(`${type}: anonymous calculation, recommendations and correction round-trip without persistence`,async()=>{
  const name='สถาบัน "ตัวอย่าง" <script> & ทดสอบ',s=await start(type,name);
  assert.doesNotMatch(s.html,/value="save"/);assert.doesNotMatch(s.html,/data-plan-input/);
  const body={...answers(type),...financialAnswers({financialSubtype:subtype,reserve:'0'}),...organizationAnswers({controlRiskLevel:'none'}),publicType:type,institutionName:name,action:'evaluate',_csrf:s.token};
  const response=await post(base,s.cookie,body);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const html=await response.text();assert.match(html,/ผลประเมินและคำแนะนำส่งเสริม/);assert.match(html,/พิมพ์ผล \/ บันทึก PDF/);assert.doesNotMatch(html,/value="save"/);assert.match(html,/ทุนสำรองเป็นศูนย์/);assert.match(html,/ความเสี่ยงและกิจกรรมควบคุม/);assert.doesNotMatch(html,/<script> & ทดสอบ/);
  const back=hidden(html);assert.equal(back.institutionName,name);assert.equal(back.publicType,type);assert.equal(back.reserve,'0');assert.equal(back.dimension2,undefined);
  const revised=await post(base,s.cookie,{...back,action:'revise'});assert.equal(revised.status,200);assert.match(await revised.text(),/id="assessment-form"/);
  const sessionState=await (await get('/test/session',s.cookie)).json();assert.deepEqual(Object.keys(sessionState).sort(),['cookie','strengthPublicCsrf']);
  const clean=await get(`${base}/new?publicType=${type}`,s.cookie);assert.doesNotMatch(await clean.text(),/name="reserve" value="0"/);
});
test('partial public input is unknown, not failed, and a name is optional',async()=>{
  const s=await start('farmer','');
  const response=await post(base,s.cookie,{publicType:'farmer',institutionName:'',action:'evaluate',_csrf:s.token});assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/ยังสรุปการผ่านเกณฑ์ไม่ได้/);assert.match(html,/สถาบันที่ประเมิน/);assert.doesNotMatch(html,/ชั้น 3 · จำลอง/);
});
test('public POST requires its own anonymous session CSRF token',async()=>{
  const a=await start(),b=await start();
  for(const token of ['',b.token,'é'.repeat(64),'a'.repeat(65)]) {
    const response=await post(base,a.cookie,{publicType:'agri',action:'evaluate',_csrf:token});assert.equal(response.status,403);
  }
});
test('public inputs reject invalid types, shape and financial data before calculation',async()=>{
  const s=await start();
  for(const publicType of ['','constructor','__proto__','invalid']) assert.equal((await post(base,s.cookie,{publicType,action:'evaluate',_csrf:s.token})).status,422);
  assert.equal((await get(base+'/new?publicType=bad')).status,422);
  for(const override of [{assets:'-1'},{institutionName:'x'.repeat(251)},{'publicType[]':'agri',publicType:''}]) {
    const response=await post(base,s.cookie,{...answers(),...financialAnswers(),publicType:'agri',action:'evaluate',_csrf:s.token,...override});assert.equal(response.status,422);
  }
});
test('public routes cannot save, read, edit or leak existing assessments',async()=>{
  const s=await start();
  assert.equal((await post(base,s.cookie,{...answers(),publicType:'agri',_csrf:s.token,action:'save',id:'1',code:'TEST-001'})).status,400);
  for(const route of ['/1','/1/edit','/list','/history','/../public/1']) assert.equal((await get(base+route,s.cookie)).status,404);
  for(const route of ['/strength/assessments/1','/strength/assessments/1/edit']) {
    const response=await get(route,s.cookie);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/auth/login');
  }
  const response=await post('/strength/assessments/1',s.cookie,{action:'save',_csrf:s.token});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/auth/login');
});
test('logged-in institution users can use the public tool but cannot bypass the staff boundary',async()=>{
  for(const query of ['', '?group=group', '?group=other&mClass=c']) {
    const login=await get('/test/institution-login'+query),cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await get(base,cookie)).status,200);assert.equal((await get(base+'/new?publicType=farmer',cookie)).status,200);
    for(const route of ['/strength/assessments/1','/strength/assessments/publicity','/strength/list']) {
      const response=await get(route,cookie);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/dashboard2');
    }
  }
});
