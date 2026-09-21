const test=require('node:test'), assert=require('node:assert/strict');
const rules=require('../services/strengthAssessmentService');
const organization=require('../services/strengthOrganizationService');
const {answers}=require('./helpers/strengthAssessmentFixture');
const {organizationAnswers}=require('./helpers/strengthOrganizationFixture');
const areas=['controlEnvironment','controlRisk','controlInformation','controlMonitoring'];
function assess(overrides={},type='agri') {
  const {data,errors}=rules.normalize(answers(type,organizationAnswers(overrides)),type);
  assert.deepEqual(errors,{}); return {data,result:rules.evaluate(data,type)};
}
for (const type of ['agri','non_agri','farmer']) {
  test(`${type}: standard separates correct indicators and sums to 20 without double counting`,()=>{
    const {data,result}=assess({},type),rows=result.organization.rows;
    assert.equal(rows.length,type==='farmer'?4:5);assert.equal(result.organization.total,20);assert.equal(result.total,100);assert.equal(result.grade,1);assert.equal(data.dimension3,undefined);
    assert.deepEqual(rows.map(r=>r.id),type==='farmer'?['3.1','3.2','3.3','3.4']:['3.1','3.2','3.3','3.4','3.5']);
    assert.ok(rows.every(r=>r.max===(type==='farmer'?5:4)));assert.equal(result.scores.filter(s=>s.id==='3').length,1);
    if(type==='farmer') assert.equal(data.accountingTechnology,undefined);
  });
  test(`${type}: every standard level receives its own weight and specific recommendation`,()=>{
    const levels=['none','low','middle','high'];
    const overrides=Object.fromEntries(areas.map((area,i)=>[area+'Level',levels[i]]));
    const {result}=assess(overrides,type),rows=result.organization.rows.slice(type==='farmer'?0:1);
    assert.deepEqual(rows.map(r=>r.level),[0,1,2,3]);
    assert.deepEqual(rows.map(r=>r.value),type==='farmer'?[0,1.67,3.33,5]:[0,1.33,2.67,4]);
    assert.equal(result.organization.total,type==='farmer'?10:12);
    assert.equal(result.recommendations.filter(r=>r.key.startsWith('organization-')).length,3);
    assert.ok(!result.recommendations.some(r=>r.key==='improve-3'));
  });
  test(`${type}: 60, 80 and 95 boundaries apply independently to all four areas`,()=>{
    for(const [n,level] of [[0,0],[60,0],[60.01,1],[80,1],[80.01,2],[95,2],[95.01,3],[100,3]]) {
      const {result}=assess({controlInput:'percent',...Object.fromEntries(areas.map(a=>[a+'Percent',String(n)]))},type);
      const rows=result.organization.rows.slice(type==='farmer'?0:1);
      assert.ok(rows.every(r=>r.level===level),`${type}: ${n}`);
      assert.equal(result.organization.total,Math.round(((type==='farmer'?20:16)*level/3+(type==='farmer'?0:4))*100)/100);
    }
  });
  test(`${type}: overall uses one control result with technology only for cooperatives`,()=>{
    for(const [controlOverall,level] of [['none',0],['low',1],['middle',2],['high',3]]) {
      const {data,result}=assess({controlMode:'overall',controlOverall,accountingTechnology:'partial'},type);
      assert.equal(result.organization.rows.length,type==='farmer'?1:2);
      assert.equal(result.organization.total,Math.round(((type==='farmer'?20:16)*level/3+(type==='farmer'?0:2))*100)/100);
      assert.equal(data.controlEnvironmentLevel,undefined);assert.equal(data.controlInput,undefined);
      assert.equal(result.gates.find(g=>g.key==='standard').passed,false);
    }
  });
}
test('unknown standard area, technology, mode or input method prevents total and classification',()=>{
  for(const override of [{controlEnvironmentLevel:''},{controlInput:''},{controlMode:''},{accountingTechnology:''},{controlMode:'overall',controlOverall:''}]) {
    const {result}=assess(override);assert.equal(result.organization.total,null);assert.equal(result.total,null);assert.equal(result.status,'draft');assert.equal(result.grade,null);assert.ok(result.missing.length);
  }
  const {result}=assess({controlInput:'percent',controlEnvironmentPercent:'0',controlRiskPercent:'0',controlInformationPercent:'0'});
  assert.equal(result.organization.rows[1].value,0);assert.equal(result.organization.rows[4].value,null);
});
test('evidence is required even with complete area scores',()=>{
  const {result}=assess({cadEvidence:''});assert.equal(result.total,100);assert.equal(result.status,'draft');assert.equal(result.grade,null);
});
test('low standard results flow through farmer and non-agricultural control gates',()=>{
  const zeros=Object.fromEntries(areas.map(a=>[a+'Level','none']));
  const {result}=assess({...zeros,accountingTechnology:'none'},'non_agri');assert.equal(result.organization.total,0);assert.equal(result.grade,3);assert.equal(result.gates.find(g=>g.key==='control2').passed,false);
  const farmer=assess({controlEnvironmentLevel:'high',controlRiskLevel:'none',controlInformationLevel:'none',controlMonitoringLevel:'none'},'farmer').result;
  assert.equal(farmer.organization.total,5);assert.equal(farmer.gates.find(g=>g.key==='control1').passed,false);assert.equal(farmer.gates.find(g=>g.key==='control2').passed,true);
});
test('technology is scored directly and does not receive a 0–3 weighting',()=>{
  for(const [accountingTechnology,value] of [['none',0],['partial',2],['full',4]]) {
    const {result}=assess({accountingTechnology});assert.equal(result.organization.rows[0].value,value);assert.equal(result.organization.total,16+value);
  }
});
test('server rejects invalid active input but ignores inactive alternative scores and injected totals',()=>{
  for(const override of [{controlEnvironmentLevel:'4'},{controlEnvironmentLevel:['high']},{accountingTechnology:'3'},{controlInput:'invalid'},{dimension3Mode:'invalid'},{controlMode:'invalid'},...['-1','100.01','95.001','NaN','Infinity','1e2',['90']].map(controlEnvironmentPercent=>({controlInput:'percent',controlEnvironmentPercent}))]) {
    assert.ok(Object.keys(rules.normalize(answers('agri',organizationAnswers(override)),'agri').errors).length,JSON.stringify(override));
  }
  const {data,result}=assess({dimension3:'999',controlEnvironmentPercent:'invalid',controlOverall:['high']});
  assert.equal(result.total,100);assert.equal(data.dimension3,undefined);assert.equal(data.controlOverall,undefined);assert.equal(data.controlEnvironmentPercent,undefined);
});
test('legacy records retain their upstream scores and new incomplete forms use detailed mode',()=>{
  const legacy=rules.normalize(answers(),'agri').data;delete legacy.dimension3Mode;
  const r=rules.evaluate(legacy,'agri');assert.equal(r.total,100);assert.equal(r.organization,null);assert.equal(r.status,'preliminary');
  const fresh=rules.normalize({},'agri').data;assert.equal(fresh.dimension3Mode,'detailed');assert.equal(rules.evaluate(fresh,'agri').grade,null);
  const sourced=rules.normalize(answers('agri',{controlEnvironmentLevel:'invalid'}),'agri');assert.deepEqual(sourced.errors,{});assert.equal(sourced.data.controlEnvironmentLevel,undefined);
});
test('weighted totals use exact fractions, preserving area inputs in the result snapshot',()=>{
  for(const type of ['agri','farmer']) {
    const {result}=assess(Object.fromEntries(areas.map(a=>[a+'Level','middle'])),type);
    assert.equal(result.organization.total,type==='farmer'?13.33:14.67);
    const copy=JSON.parse(JSON.stringify(result.organization));assert.equal(copy.rows.at(-1).input,'ดี');assert.equal(copy.rows.at(-1).level,2);
  }
  for(const invalid of ['',null,undefined,101,-1,'1e2']) assert.equal(organization.percentLevel(invalid),null);
});
