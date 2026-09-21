process.env.DB_SKIP_STARTUP_CHECK='1';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStore}=require('../models/strengthAssessmentModel');
const db=require('../config/db');
test.after(()=>db.end());
function setup({revisionFailure=false,affectedRows=1}={}) {
  const events=[];
  const connection={beginTransaction:async()=>events.push('begin'),commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release'),query:async(sql,params)=>{
    if(sql.includes('INSERT INTO strength_assessment_revisions')) {events.push('revision');if(revisionFailure)throw new Error('revision write failed');return [{affectedRows:1}];}
    if(sql.includes('UPDATE strength_assessments')) {events.push('update');assert.match(sql,/version = \? AND owner_id = \?/);assert.deepEqual(params.slice(-3),['9',4,'17']);return [{affectedRows}];}
    events.push('insert');return [{insertId:9}];
  }};
  return {events,store:createStore({query:async()=>[[]],getConnection:async()=>connection})};
}
const payload={institution:{c_code:'TEST',c_name:'ตัวอย่าง'},type:'agri',actor:{id:'17',name:'ผู้บันทึก'},document:{result:{status:'draft'}}};
test('new assessment and its first revision commit together',async()=>{const {events,store}=setup();assert.equal(await store.save(payload),9);assert.deepEqual(events,['begin','insert','revision','commit','release']);});
test('revision failure rolls back the assessment write and releases connection',async()=>{const {events,store}=setup({revisionFailure:true});await assert.rejects(store.save(payload),/revision write failed/);assert.deepEqual(events,['begin','insert','revision','rollback','release']);});
test('stale or non-owner updates do not create a new revision',async()=>{const {events,store}=setup({affectedRows:0});await assert.rejects(store.save({...payload,id:'9',version:4}),{status:409});assert.deepEqual(events,['begin','update','rollback','release']);});
