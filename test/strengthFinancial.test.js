const test = require('node:test'), assert = require('node:assert/strict');
const finance = require('../services/strengthFinancialService');
const rules = require('../services/strengthAssessmentService');
const { answers, institutions } = require('./helpers/strengthAssessmentFixture');
const { financialAnswers } = require('./helpers/strengthFinancialFixture');
const calc = (overrides = {}, type = 'agri') => finance.calculate(financialAnswers(overrides),type);
function assess(overrides = {}, type = 'agri', institution) {
  const { data, errors } = rules.normalize(answers(type,financialAnswers(overrides)),type,institution);
  assert.deepEqual(errors,{});
  return { data, result: rules.evaluate(data,type) };
}
// Independent transcription of the inclusive middle ranges from the manual tables.
const criteria = [
  ['agriculture','agri', [[.75,1.75],[.10,.20],[1.50,3],[45,65],[.75,1.75],[60,90]]],
  ['settlement','agri', [[.75,1.75],[.15,.25],[1.50,3],[50,70],[.75,1.75],[60,90]]],
  ['fishery','agri', [[.75,1.75],[.15,.25],[1.50,3],[50,70],[.75,1.75],[60,90]]],
  ['savings','non_agri', [[.50,1],[.04,.10],[2,4],[25,35],[.50,1],[85,95]]],
  ['credit_union','non_agri', [[.50,1],[.05,.11],[2,4],[40,60],[.50,1],[60,90]]],
  ['shop','non_agri', [[.50,1],[.15,.25],[4,8],[50,70],[.50,1],[85,95]]],
  ['service','non_agri', [[.50,1.50],[.15,.25],[2.50,5],[50,70],[.50,1.50],[60,90]]],
  ['farmer','farmer', [[.50,1],[.15,.25],[1.50,3],[50,70],[.50,1],[60,90]]]
];
for (const [subtype,type,bands] of criteria) {
  test(`${subtype}: six ratios use correct boundaries, truncation and direction`, () => {
    bands.forEach(([low,high], i) => {
      for (const [value,position] of [[low-.01,'below'],[low,'middle'],[high,'middle'],[high+.009,'middle'],[high+.01,'above']]) {
        // denominator 10,000 supports ratio precision .0001 using cent inputs.
        const params = [
          {liabilities:(value*10000).toFixed(2),equity:'10000'},
          {reserve:(value*10000).toFixed(2),assets:'10000'},
          {operatingProfit:(value*100).toFixed(2),assets:'10000',assetsPrevious:'10000'},
          {operatingExpenses:(value*100).toFixed(2),profitBeforeExpenses:'10000'},
          {currentAssets:(value*10000).toFixed(2),currentLiabilities:'10000'},
          {loansPaid:(value*100).toFixed(2),loansDue:'10000'}
        ][i];
        const reverse = i === 0 || i === 3;
        const expected = position === 'middle' ? 2 : position === 'below' ? reverse ? 3 : 1 : reverse ? 1 : 3;
        const row = calc({...params,financialSubtype:subtype},type).rows[i];
        assert.equal(row.level,expected,`${subtype} 2.${i+1} at ${value}`);
      }
    });
  });
  test(`${subtype}: maximum financial result flows into total and classification`, () => {
    const {result,data} = assess({financialSubtype:subtype, savings:subtype === 'savings' ? 'yes' : 'no'},type);
    assert.equal(result.financial.total,20); assert.equal(result.total,100); assert.equal(result.grade,1);
    assert.equal(data.dimension2,undefined); // The client cannot supply a calculated total.
  });
}
test('manual examples reproduce ratios and four-decimal display', () => {
  const r = calc({financialSubtype:'savings', liabilities:'575347000',equity:'966401000',reserve:'73438000',assets:'1541749000',assetsPrevious:'1460371000',operatingProfit:'59993000',operatingExpenses:'5470000',profitBeforeExpenses:'15640000',repaymentMode:'salary',totalLoans:'191202670',nplLoans:'5507490'},'non_agri');
  assert.deepEqual(r.rows.slice(0,4).map(r=>r.compared),['0.59','0.04','3.99','34.97']);
  assert.equal(r.rows[5].ratio,'97.1196'); assert.equal(r.rows[5].compared,'97.11'); assert.equal(r.rows[5].level,3);
  assert.equal(calc({loansPaid:'34787000',loansDue:'55540000'}).rows[5].compared,'62.63');
});
test('comparison truncates original fraction even when display rounds across boundary', () => {
  const r=calc({reserve:'2099999.99',assets:'10000000'}).rows[1];
  assert.equal(r.ratio,'0.2100');assert.equal(r.compared,'0.20');assert.equal(r.level,2);
  assert.equal(calc({reserve:'2900',assets:'10000'}).rows[1].compared,'0.29'); // binary floating point 0.29 must not become 0.28.
});
test('zero and negative special cases use explicit manual levels', () => {
  for(const equity of ['0','-100']) assert.equal(calc({equity}).rows[0].level,0);
  assert.equal(calc({reserve:'0'}).rows[1].level,0);
  for(const operatingProfit of ['0','-100']) assert.equal(calc({operatingProfit}).rows[2].level,0);
  for(const profitBeforeExpenses of ['0','-100']) assert.equal(calc({profitBeforeExpenses}).rows[3].level,0);
  assert.equal(calc({currentLiabilities:'0'}).rows[4].level,3);
  assert.equal(calc({loansPaid:'0'}).rows[5].level,0);
});
test('no due loans transfers weight to liquidity, not a zero score', () => {
  for(const lendingVolume of ['0','100']) {
    const r=calc({loansDue:'0',loansPaid:'0',lendingVolume,currentAssets:'100000'});
    assert.equal(r.transferred,true); assert.equal(r.rows[4].weight,7); assert.equal(r.rows[4].level,2);
    assert.equal(r.rows[4].value,4.67); assert.equal(r.rows[5].notApplicable,true); assert.equal(r.total,17.67);
  }
});
test('missing loan information never silently transfers weight or completes the assessment', () => {
  for(const overrides of [{loansDue:''},{loansDue:'0',loansPaid:'0',lendingVolume:''},{repaymentMode:''}]) {
    const {result}=assess(overrides);assert.equal(result.financial.total,null);assert.equal(result.grade,null);assert.equal(result.financial.rows[4].weight,null);
  }
  const {result}=assess({loansDue:'0',loansPaid:'',lendingVolume:'0'});assert.equal(result.status,'draft');assert.equal(result.grade,null);
});
test('negative expenses, zero denominators, inconsistent statements and salary exceptions require review', () => {
  for(const overrides of [{operatingExpenses:'-100'},{assets:'0',assetsPrevious:'0',currentAssets:'0'}, {equity:'1'}, {profitBeforeExpenses:'1'}, {repaymentMode:'salary',totalLoans:'0',nplLoans:'0'}, {repaymentMode:'salary',totalLoans:'100',nplLoans:'100'}]) {
    const {result}=assess(overrides); assert.equal(result.status,'review');assert.equal(result.grade,null);assert.ok(result.issues.length);
  }
});
test('unknown fields remain unknown; exact money arithmetic is preserved in JSON', () => {
  const {result,data}=assess({assetsPrevious:'',equity:'799999.99',liabilities:'200000.01'});
  assert.equal(result.financial.rows[2].value,null); assert.equal(result.total,null);assert.equal(result.status,'draft');
  assert.equal(data.equity,'799999.99');assert.doesNotThrow(()=>JSON.stringify(result));
  const row=calc({liabilities:'1000000000000',equity:'0.01'}).rows[0]; assert.equal(row.compared,'100000000000000.00');
});
test('weighted score totals sum exact fractions before final rounding', () => {
  const r=calc({liabilities:'1000000',equity:'1000000',reserve:'150000',assets:'1000000',assetsPrevious:'1000000',operatingProfit:'20000',operatingExpenses:'50000',profitBeforeExpenses:'100000',currentAssets:'100000',currentLiabilities:'100000',loansDue:'100000',loansPaid:'75000'});
  assert.deepEqual(r.rows.map(r=>r.level),[2,2,2,2,2,2]);assert.equal(r.total,13.33);
});
test('financial input rejects malformed, impossible and cross-type values', () => {
  for(const overrides of [{assets:'-1'},{assets:'NaN'},{assets:'1e9'},{assets:['100']},{assets:'100.001'},{assets:'1000000000001'},{loansPaid:'100001'},{currentLiabilities:'200001'},{currentAssets:'1000001'},{repaymentMode:'salary',totalLoans:'100',nplLoans:'101'},{financialSubtype:'savings'}]) {
    assert.ok(Object.keys(rules.normalize(answers('agri',financialAnswers(overrides)),'agri').errors).length,JSON.stringify(overrides));
  }
  assert.ok(rules.normalize(answers('agri',financialAnswers({financialSubtype:'settlement'})),'agri',institutions[0]).errors.financialSubtype);
  assert.ok(rules.normalize(answers('non_agri',financialAnswers({financialSubtype:'service',savings:'yes'})),'non_agri').errors.savings);
  assert.ok(rules.normalize(answers('farmer',financialAnswers({financialSubtype:'farmer',repaymentMode:'salary'})),'farmer').errors.repaymentMode);
});
test('defaults derive known subtypes without guessing unknown registry values', () => {
  assert.equal(finance.defaults(institutions[0],'agri').financialSubtype,'agriculture');assert.equal(finance.defaults(institutions[1],'non_agri').financialSubtype,'savings');
  assert.equal(finance.defaults({c_type:'ออมทรัพย์'},'non_agri').financialSubtype,'savings');
  assert.equal(finance.defaults({},'agri').financialSubtype,'');
  assert.equal(rules.normalize({},'agri').data.dimension2Mode,'financial');
});
test('legacy records keep sourced dimension 2, inactive inputs cannot affect calculated results', () => {
  const legacy=rules.normalize(answers(),'agri').data;delete legacy.dimension2Mode;
  assert.equal(rules.evaluate(legacy,'agri').total,100);assert.equal(rules.evaluate(legacy,'agri').financial,null);
  const {data,result}=assess({dimension2:'999',totalLoans:'invalid',nplLoans:['100']});
  assert.equal(data.dimension2,undefined);assert.equal(data.totalLoans,undefined);assert.equal(result.total,100);
});
test('financial gaps generate specific actionable recommendations and preserve dimension 3 gates', () => {
  const {result}=assess({reserve:'0',dimension3:'0',financialSubtype:'savings'},'non_agri');
  assert.ok(result.recommendations.some(r=>r.key==='ratio-2.2'));assert.ok(!result.recommendations.some(r=>r.key==='improve-2'));
  assert.equal(result.gates.find(g=>g.key==='control2').passed,false);assert.equal(result.grade,3);
  const farmer=assess({financialSubtype:'farmer',reserve:'0',operatingProfit:'0',operatingExpenses:'0',profitBeforeExpenses:'0'},'farmer').result;
  assert.equal(farmer.financial.total,10);assert.equal(farmer.gates.find(g=>g.key==='business1').passed,false);assert.equal(farmer.gates.find(g=>g.key==='business2').passed,true);
});
