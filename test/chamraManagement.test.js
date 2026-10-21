const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { validate, currentFiscalYear } = require('../services/chamraManagementService');
const { fiscalPeriod } = require('../services/chamraFiscalYear');

test('management validates fiscal years, numeric targets and real calendar dates', () => {
  assert.equal(validate('indicators', { fiscal_year: '2570', title: 'ตัวชี้วัด', target_value: '7', actual_value: '5', unit: 'แห่ง' }).errors.length, 0);
  assert.ok(validate('indicators', { fiscal_year: '2026', title: 'x', target_value: '-1', actual_value: 'NaN', unit: 'แห่ง' }).errors.length > 0);
  assert.ok(validate('meetings', { fiscal_year: '2570', title: 'x', meeting_no: '1', meeting_date: '2026-02-30' }).errors.length > 0);
  assert.equal(validate('meetings', { fiscal_year: '2571', title: 'x', meeting_no: '12', meeting_date: '2028-02-29' }).errors.length, 0);
  assert.throws(() => validate('__proto__', {}));
});
test('target validation limits types and does not accept client audit or file paths', () => {
  const { data, errors } = validate('targets', { fiscal_year:'2570', c_code:'001', target_type:'withdrawal', due_date:'', updated_by:'forged', report_path:'/bad', responsible:'forged name' });
  assert.equal(errors.length, 0);
  assert.equal(data.due_date, null);
  assert.equal(data.updated_by, undefined);
  assert.equal(data.report_path, undefined);
  assert.equal(data.responsible, undefined);
  assert.ok(validate('targets', {fiscal_year:'2570', c_code:'001', target_type:'other'}).errors.length);
  assert.equal(validate('meetings', {fiscal_year:'2570', title:'x', meeting_no:'1', meeting_date:'2026-10-19', report_path:'https://bad'}).data.report_path, undefined);
});
test('default fiscal year follows Bangkok October rollover', () => {
  for (const [now, expected] of [['2026-09-30T16:59:00Z',2569], ['2026-09-30T17:00:00Z',2570]]) {
    assert.equal(currentFiscalYear(new Date(now)), expected);
  }
  assert.equal(typeof currentFiscalYear(), 'number');
});
function loadController(model, overrides = {}) {
  const filename = path.resolve(__dirname, '../controllers/chamraManagementController.js');
  const localRequire = createRequire(filename);
  const sandbox = { module:{exports:{}}, Buffer, __dirname:path.dirname(filename), require:name => Object.hasOwn(overrides, name) ? overrides[name] : name === '../models/chamraManagementModel' ? {availableYears:async()=>[],...model} : localRequire(name) };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, {filename});
  return sandbox.module.exports;
}
function response() {
  return { code:200, status(code) {this.code=code;return this;}, send(body) {this.body=body;return this;}, render(view,data) {this.view=view;this.data=data;return this;}, redirect(url) {this.url=url;return this;} };
}
test('target institution options include both liquidation statuses', async () => {
  const filename = path.resolve(__dirname, '../models/chamraManagementModel.js');
  const localRequire = createRequire(filename);
  let sql;
  const sandbox = {
    module:{exports:{}},
    require:name => name === '../config/db'
      ? {query:async query => { sql = query; return [[{c_code:'001',c_name:'ทดสอบ'}]]; }}
      : localRequire(name)
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, {filename});
  const rows = await sandbox.module.exports.institutions();
  assert.deepEqual(Array.from(rows), [{c_code:'001',c_name:'ทดสอบ'}]);
  assert.match(sql, /c_status IN \('เลิก', 'เลิก\/ชำระบัญชี'\)/);
});
test('management rejects forged submissions and saves validated fields with session author', async () => {
  let saved;
  const controller = loadController({save:async(...args)=>{saved=args;}});
  const req = {params:{type:'indicators'},body:{_csrf:'token',fiscal_year:'2570',title:'test',target_value:'7',actual_value:'5',unit:'แห่ง',updated_by:'forged'},session:{chamraToken:'token',user:{fullname:'Session author'}}};
  const res = response();
  await controller.save(req,res);
  assert.equal(saved[3],'Session author');
  assert.equal(saved[2].updated_by,undefined);
  assert.equal(res.url,'/chamra/manage/indicators?year=2570&saved=1');
  saved = null;
  req.body._csrf='wrong';
  const rejected = response();
  await controller.save(req,rejected);
  assert.equal(rejected.code,403);
  assert.equal(saved,null);
});
test('duplicate save preserves entered values and existing PDF', async () => {
  const controller = loadController({get:async()=>({id:1,report_path:'/file/original.pdf'}),save:async()=>{const e=new Error('duplicate');e.code='ER_DUP_ENTRY';throw e;}});
  const res=response();
  await controller.save({params:{type:'meetings',id:'1'},body:{_csrf:'token',fiscal_year:'2570',title:'Updated title',meeting_no:'1',meeting_date:'2026-10-19'},session:{chamraToken:'token',user:{username:'admin'}}},res);
  assert.equal(res.code,409);
  assert.equal(res.data.record.title,'Updated title');
  assert.equal(res.data.record.report_path,'/file/original.pdf');
});
test('invalid PDF is rejected without saving the record', async () => {
  let saved=false;
  const controller=loadController({save:async()=>{saved=true;}});
  const res=response();
  await controller.save({params:{type:'meetings'},body:{_csrf:'token',fiscal_year:'2570',title:'Meeting',meeting_no:'1',meeting_date:'2026-10-19'},file:{originalname:'report.pdf',buffer:Buffer.from('<html>bad')},session:{chamraToken:'token',user:{username:'admin'}}},res);
  assert.equal(res.code,400);assert.equal(saved,false);
});
test('management templates render forms, escaped content and empty or populated dashboard', async () => {
  const ejs = require('ejs');
  const { TYPES, TARGET_TYPES } = require('../services/chamraManagementService');
  const base = {title:'ทดสอบ',user:{mClass:'admin'},period:fiscalPeriod(2570)};
  for (const type of Object.keys(TYPES)) {
    const html = await ejs.renderFile(path.resolve(__dirname,'../views/chamra/manage/form.ejs'), {...base,type,config:TYPES[type],targetTypes:TARGET_TYPES,record:{fiscal_year:2570,title:'<script>bad</script>'},errors:[],institutions:[],csrf:'token'});
    assert.ok(html.includes('name="_csrf"'));
    assert.ok(html.includes(`action="/chamra/manage/${type}/add"`));
    assert.ok(!html.includes('<script>bad</script>'));
    const list = await ejs.renderFile(path.resolve(__dirname,'../views/chamra/manage/index.ejs'), {...base,type,types:TYPES,targetTypes:TARGET_TYPES,rows:[],year:2570,csrf:'token',saved:false,deleted:false});
    assert.ok(list.includes('ยังไม่มีข้อมูลปี'));
  }
  const common = {...base, data:[],members:{},octoberMovement:[],octoberMovementSummary:{total:0,coop:0,farmer:0},withdrawnThisYearSummary:{total:0,coop:0,farmer:0},withdrawalRows:[],updated:false,managementYear:2570,managementTargetTypes:TARGET_TYPES};
  const empty = await ejs.renderFile(path.resolve(__dirname,'../views/chamra/list.ejs'), {...common,managementData:{indicators:[],targets:[],meetings:[]}});
  assert.ok(empty.includes('ยังไม่มีตัวชี้วัดสำหรับปีนี้'));
  const populated = await ejs.renderFile(path.resolve(__dirname,'../views/chamra/list.ejs'), {...common,managementData:{indicators:[{title:'Test KPI',target_value:7,actual_value:5,unit:'แห่ง'}],targets:[{c_code:'001',c_name:'สถาบัน',target_type:'withdrawal'}],meetings:[{title:'ประชุม',meeting_no:1,fiscal_year:2570,meeting_date:'2026-10-19',report_path:'/uploads/chamra-meetings/test.pdf'}]}});
  assert.ok(populated.includes('71.43%'));
  assert.ok(populated.includes('/uploads/chamra-meetings/test.pdf'));
  const fallback = await ejs.renderFile(path.resolve(__dirname,'../views/chamra/list.ejs'), {...common,managementYear:2569,period:fiscalPeriod(2569),managementData:null});
  assert.ok(fallback.includes('meeting4_2569.pdf'));
});

test('target lists read current institution responsible person instead of saved target name', async () => {
  const filename = path.resolve(__dirname, '../models/chamraManagementModel.js');
  const localRequire = createRequire(filename);
  let sql, params;
  const sandbox = { module:{exports:{}}, require:name => name === '../config/db'
    ? {query:async (query, values) => {sql=query;params=values;return [[]];}}
    : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  await sandbox.module.exports.list('targets',2570);
  assert.match(sql,/cd.de_person AS responsible/);
  assert.match(sql,/LEFT JOIN chamra_detail cd ON cd.de_code = t.c_code/);
  assert.equal(params[0],2570);
});
test('target form displays existing responsible person and prevents typing a separate name', async () => {
  const ejs = require('ejs');
  const { TYPES, TARGET_TYPES } = require('../services/chamraManagementService');
  const html = await ejs.renderFile(path.resolve(__dirname,'../views/chamra/manage/form.ejs'), {
    title:'Test',user:null,period:fiscalPeriod(2570),type:'targets',config:TYPES.targets,targetTypes:TARGET_TYPES,
    record:{fiscal_year:2570,c_code:'001'},errors:[],csrf:'token',
    institutions:[{c_code:'001',c_name:'Institution',de_person:'Current <person>'}]
  });
  assert.match(html,/data-responsible="Current &lt;person&gt;"/);
  assert.match(html, /id="responsible"[^>]*readonly/);
  assert.ok(!html.includes('name="responsible"'));
});

test('document upload validates contents, ignores submitted storage paths and manages file lifecycle', async () => {
  const writes=[],deletes=[];
  let saved,existing=null,fail=false;
  const fakeFs={mkdir:async()=>{},writeFile:async(...args)=>writes.push(args),unlink:async file=>deletes.push(file)};
  const controller=loadController({get:async()=>existing,save:async(...args)=>{if(fail)throw new Error('DB failed');saved=args;},remove:async()=>{}},{'fs/promises':fakeFs});
  const req={params:{type:'documents'},body:{_csrf:'token',fiscal_year:'2570',title:'Document',report_path:'/forged',original_name:'forged'},session:{chamraToken:'token',user:{username:'admin'}}};
  let res=response();
  await controller.save(req,res);
  assert.equal(res.code,400);
  assert.equal(writes.length,0);
  req.file={originalname:'test.pdf',buffer:Buffer.from('%PDF-test')};
  res=response();
  await controller.save(req,res);
  assert.match(saved[2].report_path,/^\/storage\/chamra-documents\/[a-f0-9-]+\.pdf$/);
  assert.equal(saved[2].original_name,'test.pdf');
  assert.equal(saved[2].file_size,9);
  assert.equal(writes.length,1);
  const storedPath=saved[2].report_path;
  existing={id:1,...saved[2]};req.params.id='1';delete req.file;
  await controller.save(req,response());
  assert.equal(writes.length,1);
  assert.equal(saved[2].report_path,undefined);
  req.file={originalname:'replacement.pdf',buffer:Buffer.from('%PDF-new')};
  await controller.save(req,response());
  assert.ok(deletes[0].endsWith(storedPath));
  existing={id:1,...saved[2]};
  fail=true;
  await assert.rejects(controller.save(req,response()),/DB failed/);
  assert.ok(deletes[1].endsWith(path.basename(writes[2][0])));
  fail=false;
  await controller.remove(req,response());
  assert.ok(deletes[2].endsWith(existing.report_path));
});
test('document validation rejects unsupported, oversized or disguised files', () => {
  const {validDocument,documentPath}=require('../services/chamraDocumentService');
  assert.equal(validDocument({originalname:'file.pdf',buffer:Buffer.from('<html>')}),false);
  assert.equal(validDocument({originalname:'file.html',buffer:Buffer.from('%PDF-')}),false);
  assert.equal(validDocument({originalname:'file.doc',buffer:Buffer.from('d0cf11e0a1b11ae1','hex')}),true);
  assert.equal(validDocument({originalname:'file.xlsx',buffer:Buffer.from('504b0304','hex')}),true);
  assert.equal(validDocument({originalname:'file.pdf',buffer:Buffer.alloc(10*1024*1024+1)}),false);
  assert.equal(documentPath('/storage/chamra-documents/../../.env'),null);
  assert.equal(documentPath('/uploads/other.pdf'),null);
});
test('public document download selects a record and forces attachment with original filename', async () => {
  let record={report_path:'/storage/chamra-documents/12345678-1234-1234-1234-123456789012.pdf',original_name:'original.pdf'};
  const c=loadController({get:async()=>record});
  const res=response();res.set=()=>{};
  res.download=(file,name,callback)=>{res.file=file;res.filename=name;res.callback=callback;};
  await c.downloadDocument({params:{id:'1'}},res,()=>{});
  assert.ok(res.file.endsWith(record.report_path));
  assert.equal(res.filename,'original.pdf');
  res.callback(Object.assign(new Error('missing'),{code:'ENOENT'}));
  assert.equal(res.code,404);
  record={report_path:'/etc/passwd'};
  await c.downloadDocument({params:{id:'1'}},response(),()=>assert.fail());
  const invalid=response();
  await c.downloadDocument({params:{id:'../1'}},invalid,()=>assert.fail());
  assert.equal(invalid.code,404);
});
test('related documents section exposes downloads publicly and upload controls only to managers', async () => {
  const ejs=require('ejs');
  const filename=path.resolve(__dirname,'../views/chamra/manage/documents.ejs');
  const base={managementYear:2570,documents:[{id:1,title:'<script>bad</script>',original_name:'test.pdf',file_size:1024}]};
  const publicHtml=await ejs.renderFile(filename,{...base,user:null});
  assert.ok(publicHtml.includes('/chamra/documents/1/download'));
  assert.ok(!publicHtml.includes('<script>bad</script>'));
  assert.ok(!publicHtml.includes('/manage/documents/add'));
  const managerHtml=await ejs.renderFile(filename,{...base,user:{mClass:'admin'}});
  assert.ok(managerHtml.includes('/manage/documents/add?year=2570'));
});
