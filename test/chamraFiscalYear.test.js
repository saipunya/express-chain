const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { dateKey, currentFiscalYear, resolveFiscalYear, fiscalPeriod } = require('../services/chamraFiscalYear');
const { validate } = require('../services/chamraManagementService');
const { buildMovementRow } = require('../services/chamraSummaryService');

test('Thai fiscal year includes October 1 through September 30 in Bangkok', () => {
  assert.equal(currentFiscalYear('2026-09-30'), 2569);
  assert.equal(currentFiscalYear('2026-10-01'), 2570);
  assert.equal(currentFiscalYear(new Date('2026-09-30T16:59:59Z')), 2569);
  assert.equal(currentFiscalYear(new Date('2026-09-30T17:00:00Z')), 2570);
  assert.equal(dateKey(null), null);
  assert.equal(dateKey(undefined), null);
  assert.equal(dateKey('2026-02-30'), null);
  assert.equal(resolveFiscalYear(['2569'], new Date('2026-10-19')), 2570);
  assert.equal(resolveFiscalYear('2569'), 2569);
});
test('periods cap past reports at September 30 and omit future activities', () => {
  const past = fiscalPeriod(2569, new Date('2026-10-19'));
  assert.equal(past.startDate, '2025-10-01');
  assert.equal(past.endDate, '2026-09-30');
  assert.equal(past.asOfDate, '2026-09-30');
  assert.equal(past.baselineDate, '2025-09-30');
  assert.equal(past.months[0].key, '2025-10');
  assert.equal(past.months[11].key, '2026-09');
  const current = fiscalPeriod(2570, new Date('2026-10-19T05:00:00Z'));
  assert.equal(current.asOfDate, '2026-10-19');
  assert.equal(current.hasStarted, true);
  assert.equal(fiscalPeriod(2571, new Date('2026-10-19')).hasStarted, false);
});
test('October 1 activity is new progress, while later years cannot change the historical snapshot', () => {
  const row = buildMovementRow({pr_code:'001',pr_s1:'2025-09-30',pr_s2:'2025-10-01',pr_s3:'2026-09-30',pr_s9:'2026-10-01',pr_s10:'0000-00-00'},'2025-10-01','2026-09-30');
  assert.equal(row.oct1_step,1);
  assert.equal(row.current_max_step,3);
  assert.equal(row.oct1_date,'2025-09-30');
  assert.deepEqual(row.activities,[{step:2,date:'2025-10-01'},{step:3,date:'2026-09-30'}]);
  assert.equal(buildMovementRow({pr_s1:'2025-09-30',pr_s2:'2026-10-01'},'2025-10-01','2026-09-30'),null);
});
test('meeting and target dates must belong to the selected fiscal year', () => {
  const meeting = {fiscal_year:'2570',title:'Meeting',meeting_no:'1'};
  for (const date of ['2026-10-01','2027-09-30']) assert.equal(validate('meetings',{...meeting,meeting_date:date}).errors.length,0);
  for (const date of ['2026-09-30','2027-10-01']) assert.ok(validate('meetings',{...meeting,meeting_date:date}).errors.length);
  assert.ok(validate('targets',{fiscal_year:'2570',c_code:'001',target_type:'withdrawal',due_date:'2026-09-30'}).errors.length);
});
function loadController(model, management = {}) {
  const filename = path.resolve(__dirname,'../controllers/chamraController.js');
  const localRequire = createRequire(filename);
  const sandbox = {module:{exports:{}},Buffer,console,__dirname:path.dirname(filename),require: name => {
    if (name === '../models/chamraModel') return model;
    if (name === '../models/chamraManagementModel') return {availableYears:async()=>[],...management};
    if (name === '../config/db') return {query:async()=>[[]]};
    return localRequire(name);
  }};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  return sandbox.module.exports;
}
test('main report uses selected fiscal period and counts withdrawal from step 9 only', async () => {
  let range;
  const controller = loadController({getAll:async()=>[
    {c_code:'A1',pr_s9:'2026-09-30',pr_s10:'2026-10-01'},
    {c_code:'C1',pr_s9:'2025-09-30',pr_s10:'2025-10-01'},
    {c_code:'A2',pr_s9:'2026-10-01'}
  ],getProcessesInDateRange:async(...args)=>{range=args;return [];}},{list:async()=>[]});
  let locals;
  await controller.list({query:{year:'2569'}},{render:(view,data)=>{locals=data;}});
  assert.deepEqual(range,['2025-10-01','2026-09-30']);
  assert.equal(locals.withdrawnThisYearSummary.total,1);
  assert.equal(locals.withdrawalRows.length,1);
  assert.equal(locals.withdrawalRows[0].c_code,'A1');
});
test('summary generates the selected 12 months and supplies all activity steps', async () => {
  let range;
  const controller=loadController({getProcessesInDateRange:async(...args)=>{range=args;return [{oct1_step:1,current_max_step:3,activities:[{step:2,date:'2025-10-01'},{step:3,date:'2026-09-30'}]}];}});
  let locals;
  await controller.getChamraSummary({query:{year:'2569'}},{render:(view,data)=>{locals=data;}});
  assert.deepEqual(range,['2025-10-01','2026-09-30']);
  assert.equal(locals.period.months.length,12);
  assert.ok(locals.data[0].activities[0].label);
});
test('meeting report groups targets from the selected year instead of reusing legacy lists', async () => {
  const selected=[];
  const controller=loadController({getAll:async()=>[{c_code:'001',c_name:'Institution'}],getPoblemsByYear:async(year)=>{selected.push(year);return [];}},{list:async(type,year)=>{selected.push(year);return [{c_code:'001',target_type:'litigation'}];}});
  let locals;
  await controller.showAll({query:{year:'2568'}},{render:(view,data)=>{locals=data;}});
  assert.deepEqual(selected,[2568,2568]);
  assert.equal(locals.sections[2].rows.length,1);
  assert.equal(locals.sections[3].rows.length,0);
  assert.equal(locals.problemYear,2568);
});
test('historical snapshots remove later steps without changing source data', () => {
  const { snapshotProcesses } = require('../services/chamraSummaryService');
  const original = [{pr_s1:'2025-10-01',pr_s9:'2026-09-30',pr_s10:'2026-10-01'}];
  const snapshot = snapshotProcesses(original,'2026-09-30');
  assert.equal(snapshot[0].pr_s9,'2026-09-30');
  assert.equal(snapshot[0].pr_s10,null);
  assert.equal(original[0].pr_s10,'2026-10-01');
});
test('database report uses supplied bounds and returns every activity within the year', async () => {
  const filename = path.resolve(__dirname,'../models/chamraModel.js');
  const localRequire=createRequire(filename);
  let parameters;
  const sandbox={module:{exports:{}},require:name=>name==='../config/db'?{query:async(sql,values)=>{
    parameters=values;
    return [[{pr_code:'001',c_name:'Institution',pr_s1:'2025-09-30',pr_s2:'2025-10-01',pr_s3:'2026-09-30',pr_s9:'2026-10-01'}]];
  }}:localRequire(name)};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  const rows=await sandbox.module.exports.getProcessesInDateRange('2025-10-01','2026-09-30');
  assert.equal(parameters.length,20);
  assert.equal(parameters[0],'2025-10-01');assert.equal(parameters[1],'2026-09-30');
  assert.equal(rows[0].current_max_step,3);
  assert.equal(rows[0].activities.length,2);
  parameters=null;
  assert.equal((await sandbox.module.exports.getProcessesInDateRange('2027-10-01','2026-10-19')).length,0);
  assert.equal(parameters,null);
});
test('fiscal reports render correct months, selected year links and historical steps', async () => {
  const ejs=require('ejs');
  const base={title:'Test',user:{mClass:'admin'},period:fiscalPeriod(2569,new Date('2026-10-19')),year:2569};
  const summary=await ejs.renderFile(path.resolve(__dirname,'../views/chamra/summary.ejs'),{...base,data:[{institution_name:'Institution',oct1_step:1,oct1_step_label:'Step 1',current_max_step:3,current_max_step_label:'Step 3',activities:[{step:2,date:'2025-10-01',label:'Step 2'},{step:3,date:'2026-09-30',label:'Step 3'}]}]});
  assert.ok(summary.includes('ต.ค. 68'));assert.ok(summary.includes('ก.ย. 69'));
  assert.ok(summary.includes('ขั้น 2 •'));assert.ok(summary.includes('ขั้น 3 •'));
  const showAll=await ejs.renderFile(path.resolve(__dirname,'../views/chamra/show_all.ejs'),{...base,data:[],problemYear:2569,problemsByCode:{},sections:[],q:'',});
  assert.ok(showAll.includes('/chamra/show-all/export/pdf?year=2569'));
  assert.ok(showAll.includes('name="year"'));
  const problems=await ejs.renderFile(path.resolve(__dirname,'../views/chamra/poblem/list.ejs'),{...base,poblems:[]});
  assert.ok(problems.includes('/chamra/poblem/add?year=2569'));
});
test('history navigation retains old recorded years and offers previous and current years', async () => {
  const { fiscalNavigation } = require('../services/chamraFiscalYear');
  const navigation = fiscalNavigation(2568, [2520,2569,2569,0,9999], new Date('2026-10-19'));
  assert.equal(navigation.currentYear,2570);
  assert.equal(navigation.yearOptions.find(o=>o.year===2520).hasData,true);
  assert.equal(navigation.yearOptions.find(o=>o.year===2568).hasData,false);
  assert.ok(!navigation.yearOptions.some(o=>o.year===9999));
  const ejs=require('ejs');
  const html=await ejs.renderFile(path.resolve(__dirname,'../views/chamra/manage/fiscal-filter.ejs'),{...navigation,period:fiscalPeriod(2568,new Date('2026-10-19'))});
  assert.ok(html.includes('value="2520"'));
  assert.ok(html.includes('href="?year=2567"'));
  assert.ok(html.includes('href="?year=2570"'));
  assert.ok(html.includes('กำลังดูข้อมูลย้อนหลังปีงบประมาณ 2568'));
});
test('available years combine stored forms, meeting follow-ups and process activity dates', async () => {
  const filename=path.resolve(__dirname,'../models/chamraManagementModel.js');
  const localRequire=createRequire(filename);
  const sandbox={module:{exports:{}},require:name=>name==='../config/db'?{query:async sql=>{
    if (sql.includes('FROM chamra_targets')) { const error=new Error('missing');error.code='ER_NO_SUCH_TABLE';throw error; }
    if (sql.includes('FROM chamra_poblem')) return [[{fiscal_year:'2567'}]];
    if (sql.includes('FROM chamra_process')) return [[{fiscal_year:2520},{fiscal_year:2569},{fiscal_year:0}]];
    return [[{fiscal_year:2569},{fiscal_year:2570}]];
  }}:localRequire(name)};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  const years=await sandbox.module.exports.availableYears();
  assert.deepEqual(Array.from(years),[2570,2569,2567,2520]);
});
