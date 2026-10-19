const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { buildProcessRegister, processLocation } = require('../services/chamraProcessService');
const { currentFiscalYear } = require('../services/chamraFiscalYear');
const now = new Date('2026-10-19T05:00:00Z');
const rows = [
  {pr_id:1,pr_code:'open',c_name:'Open institution',pr_s8:'2025-08-01'},
  {pr_id:2,pr_code:'pending10',pr_s9:'2026-09-30'},
  {pr_id:3,pr_code:'archived',c_name:'Archived institution',c_status:'ถอนชื่อ',pr_s9:'2025-10-01',pr_s10:'2026-09-30'},
  {pr_id:4,pr_code:'crossYear',pr_s9:'2026-09-30',pr_s10:'2026-10-01'},
  {pr_id:5,pr_code:'new9',pr_s9:'2026-10-01'},
  {pr_id:6,pr_code:'legacy',pr_s9:'0000-00-00',pr_s10:'1899-11-30'},
  {pr_id:null,pr_code:'noProcess',c_status:'เลิก'},
  {pr_id:7,pr_code:'old10only',pr_s10:'2025-10-01'}
];
test('current process list includes unfinished work and either final step in the fiscal year', () => {
  const result=buildProcessRegister(rows,{},now);
  assert.equal(result.year,2570);
  assert.equal(result.view,'year');
  assert.deepEqual(result.processes.map(p=>p.pr_code),['open','pending10','crossYear','new9','legacy','noProcess']);
  assert.ok(result.processes.find(p=>p.pr_code==='pending10').process_status.includes('รอส่งมอบ'));
  assert.equal(rows[5].pr_s9,'0000-00-00');
});
test('history includes each year of steps 9 and 10; all mode includes withdrawn and missing registry rows', () => {
  const historical=buildProcessRegister(rows,{year:'2569'},now);
  assert.deepEqual(historical.processes.map(p=>p.pr_code),['pending10','archived','crossYear','old10only']);
  const all=buildProcessRegister([...rows,{pr_id:8,pr_code:'orphan',c_name:null,pr_s10:'2020-01-01'}],{view:'all'},now);
  assert.equal(all.processes.length,9);
  assert.equal(all.totalRecords,9);
  assert.ok(all.yearOptions.some(option=>option.year===2563 && option.hasData));
  assert.equal(all.processReturn,'/chamra/process?view=all');
});
test('process return navigation accepts only supported filters', () => {
  assert.equal(processLocation({view:'all',year:'2568'},now),'/chamra/process?view=all');
  assert.equal(processLocation({year:'2568'},now),'/chamra/process?year=2568');
  assert.equal(processLocation({year:'https://example.com',view:'bad'},now),'/chamra/process?year=2570');
});
function controller(model) {
  const filename=path.resolve(__dirname,'../controllers/chamraController.js');
  const requireHere=createRequire(filename);
  const sandbox={module:{exports:{}},Buffer,console,__dirname:path.dirname(filename),require:name=> {
    if(name==='../models/chamraModel') return model;
    if(name==='../config/db') return {};
    if(name==='../models/chamraManagementModel') return {availableYears:async()=>[],list:async()=>[]};
    return requireHere(name);
  }};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  return sandbox.module.exports;
}
test('process controller loads the full register, defaults to current year and keeps filters after saving', async () => {
  let calls=0;
  const c=controller({getProcessRegister:async()=>{calls++;return rows;},updateProcess:async()=>true,deleteProcess:async()=>true});
  let locals;
  await c.process({query:{view:'all'}},{render:(view,data)=>{locals=data;}});
  assert.equal(calls,1);
  assert.equal(locals.processes.length,rows.length);
  assert.equal(locals.user,null);
  await c.processList({query:{}},{render:(view,data)=>{locals=data;}});
  assert.equal(locals.year,currentFiscalYear());
  let redirect;
  await c.processUpdate({params:{pr_id:'1'},body:{year:'2568',pr_s9:'2025-01-01'}},{redirect:url=>{redirect=url;}});
  assert.equal(redirect,'/chamra/process?year=2568');
  await c.processDelete({params:{pr_id:'1'},body:{view:'all'}},{redirect:url=>{redirect=url;}});
  assert.equal(redirect,'/chamra/process?view=all');
});
test('process template offers history and all records, hides public edit forms, and searches within the selected list', async () => {
  const ejs=require('ejs');
  const {JSDOM}=require('jsdom');
  const filename=path.resolve(__dirname,'../views/chamra/process/list.ejs');
  const register=buildProcessRegister(rows,{view:'all'},now);
  const html=await ejs.renderFile(filename,{...register,user:null,title:'Test'});
  const dom=new JSDOM(html,{url:'http://localhost/chamra/process?view=all',runScripts:'outside-only'});
  const doc=dom.window.document;
  assert.ok(doc.querySelector('a[href="/chamra/process?view=all"]'));
  assert.equal(doc.querySelectorAll('.process-data-row').length,rows.length);
  assert.equal(doc.querySelector('input[name="pr_s9"]'),null);
  const script=Array.from(doc.querySelectorAll('script')).find(s=>s.textContent.includes("document.getElementById('processSearch')"));
  dom.window.eval(script.textContent);
  const search=doc.getElementById('processSearch');
  search.value='Archived';search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(Array.from(doc.querySelectorAll('.process-data-row')).filter(row=>!row.hidden).length,1);
  search.value='No match';search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(doc.getElementById('processEmpty').hidden,false);
  dom.window.close();
  const admin=await ejs.renderFile(filename,{...register,user:{mClass:'admin'},title:'Test'});
  assert.ok(admin.includes('name="view" value="all"'));
  assert.ok(admin.includes('/chamra/process/add?pr_code=noProcess'));
  assert.ok(!admin.includes('edit-row-null'));
});
test('prior-year step 9 remains trackable but never counts as this year withdrawal performance', () => {
  const current=buildProcessRegister(rows,{},now);
  assert.equal(current.withdrawalPerformance,1);
  assert.equal(current.priorYearWithdrawals,2);
  assert.equal(current.processes.find(row=>row.pr_code==='pending10').prior_year_withdrawal,true);
  assert.equal(current.processes.find(row=>row.pr_code==='crossYear').withdrawal_in_year,false);
  assert.equal(current.processes.find(row=>row.pr_code==='new9').withdrawal_in_year,true);
  const future=buildProcessRegister([{pr_id:1,pr_s9:'2027-01-01'}],{},now);
  assert.equal(future.withdrawalPerformance,0);
});
test('movement after a prior-year withdrawal is follow-up rather than a new upgrade achievement', async () => {
  const c=controller({getAll:async()=>[],getProcessesInDateRange:async()=>[{institution_code:'A1',oct1_step:9,current_max_step:10}]});
  let locals;
  await c.list({query:{year:'2569'}},{render:(view,data)=>{locals=data;}});
  assert.ok(locals.octoberMovement[0].movement_status.includes('ไม่นับผลงาน'));
  assert.ok(!locals.octoberMovement[0].movement_status.includes('ยกระดับขั้น'));
});
