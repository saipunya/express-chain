const test = require('node:test');
const assert = require('node:assert/strict');
const { buildChamraSummary, getLatestProcess } = require('../services/chamraSummaryService');

test('chamra summary uses the latest valid process step', () => {
  const row = { pr_s1: '2025-01-01', pr_s4: '2025-04-01', pr_s8: '1899-11-30' };
  assert.deepEqual(getLatestProcess(row), { step: 4, date: '2025-04-01' });
});

test('chamra summary separates ongoing, withdrawn and institution types', () => {
  const summary = buildChamraSummary([
    { c_name: 'สหกรณ์หนึ่ง จำกัด', coop_group: 'สหกรณ์', pr_s1: '2025-01-01', pr_s6: '2025-06-01' },
    { c_name: 'กลุ่มเกษตรกรทำนาหนึ่ง', coop_group: '', pr_s1: '2025-01-01', pr_s10: '2025-10-01' },
    { c_name: 'สหกรณ์สอง จำกัด', coop_group: '' }
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.withdrawn, 1);
  assert.equal(summary.noProcess, 1);
  assert.equal(summary.cooperativeCount, 2);
  assert.equal(summary.farmerGroupCount, 1);
  assert.ok(Math.abs(summary.completionPercent - (100 / 3)) < 0.000001);
  assert.deepEqual(summary.steps.map(({ step, count }) => ({ step, count })), [
    { step: 6, count: 1 },
    { step: 10, count: 1 }
  ]);
});
