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

const { buildCurrentFiscalChamraSummary } = require('../services/chamraSummaryService');

test('homepage rolls fiscal year over at midnight Bangkok and carries unfinished work', () => {
  const rows = [
    { pr_s1: '2026-09-01', pr_s9: '2026-09-30', pr_s10: '2026-10-02' },
    { pr_s1: '2026-09-01', pr_s9: '2026-10-01' },
    { pr_s1: '2025-01-01', pr_s4: '2026-10-01' },
    { de_comdate: '2026-10-01' },
    { de_comdate: '2026-11-01', pr_s1: '2026-11-01' }
  ];
  const before = buildCurrentFiscalChamraSummary(rows, new Date('2026-09-30T16:59:59Z'));
  assert.equal(before.fiscalYear, 2569);
  assert.equal(before.total, 3);
  assert.equal(before.withdrawn, 1);
  const after = buildCurrentFiscalChamraSummary(rows, new Date('2026-09-30T17:00:00Z'));
  assert.equal(after.fiscalYear, 2570);
  assert.equal(after.total, 3);
  assert.equal(after.withdrawn, 1);
  assert.equal(after.inProgress, 1);
  assert.equal(after.noProcess, 1);
  assert.deepEqual(after.steps.map(s => s.step), [4, 9]);
  assert.equal(after.period.startDate, '2026-10-01');
  assert.equal(after.period.endDate, '2027-09-30');
  assert.equal(after.period.asOfDate, '2026-10-01');
  assert.equal(rows[0].pr_s10, '2026-10-02');
});

test('homepage shows current year even with no progress and excludes future steps', () => {
  const summary = buildCurrentFiscalChamraSummary([
    { pr_s1: '2026-09-30', pr_s9: '2026-12-01' },
    { pr_s9: '2025-09-30', pr_s10: '2026-10-01' }
  ], new Date('2026-11-07T05:00:00Z'));
  assert.equal(summary.fiscalYear, 2570);
  assert.equal(summary.total, 1);
  assert.equal(summary.withdrawn, 0);
  assert.equal(summary.inProgress, 1);
  assert.equal(buildCurrentFiscalChamraSummary([], '2026-10-01').fiscalYear, 2570);
});
