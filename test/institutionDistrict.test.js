const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');
const { buildInstitutionDistrictSummary } = require('../services/institutionDistrictService');

test('district totals sum both types numerically, including unmatched institutions', () => {
  const summary = buildInstitutionDistrictSummary([
    { district: null, cooperatives: '2', farmerGroups: '3' },
    { district: ' เมืองชัยภูมิ ', cooperatives: '14', farmerGroups: '4' },
    { district: 'คอนสาร', cooperatives: '6', farmerGroups: '4' },
    { district: 'เนินสง่า', cooperatives: '2', farmerGroups: '0' }
  ]);
  assert.deepEqual(summary.totals, { cooperatives: 24, farmerGroups: 11, total: 35 });
  assert.equal(summary.unknownTotal, 5);
  assert.equal(summary.rows.at(-1).district, 'ไม่ระบุอำเภอ');
  assert.equal(summary.rows.at(-1).isUnknown, true);
  assert.equal(summary.rows.find((row) => row.district === 'เมืองชัยภูมิ').total, 18);
  assert.equal(summary.rows.find((row) => row.district === 'เนินสง่า').farmerGroups, 0);
});

test('empty district data has an empty list and zero totals', () => {
  assert.deepEqual(buildInstitutionDistrictSummary(), {
    rows: [], totals: { cooperatives: 0, farmerGroups: 0, total: 0 }, unknownTotal: 0
  });
});

test('main displays district counts in the hero and escapes district labels', async () => {
  const summary = buildInstitutionDistrictSummary([
    { district: 'เมืองชัยภูมิ', cooperatives: '14', farmerGroups: '4' },
    { district: '<img src=x onerror=alert(1)>', cooperatives: '1', farmerGroups: '0' },
    { district: null, cooperatives: '2', farmerGroups: '3' }
  ]);
  const html = await ejs.renderFile(path.join(__dirname, '../views/main.ejs'), {
    title: 'หน้าแรก', user: null, returnTo: '', institutionDistrictSummary: summary
  });
  const dom = new JSDOM(html);
  const hero = dom.window.document.querySelector('.main-hero');
  assert.ok(hero.querySelector('#institutionDistrictTitle'));
  assert.equal(hero.querySelectorAll('tbody tr').length, 3);
  assert.equal(hero.querySelector('table img'), null);
  assert.match(hero.querySelector('table').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.deepEqual(Array.from(hero.querySelectorAll('tfoot td'), (cell) => cell.textContent), ['17', '7', '24']);
  assert.match(hero.querySelector('.main-district-note').textContent, /ยังไม่ระบุอำเภอ 5 แห่ง/);
  assert.doesNotMatch(dom.window.document.body.textContent, /ประชุมใหญ่|ปิดบัญชี/);
  dom.window.close();
});

test('a failed district query shows an error instead of reporting zero institutions', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '../views/main.ejs'), {
    title: 'หน้าแรก', user: null, returnTo: '',
    institutionDistrictSummary: buildInstitutionDistrictSummary([]), institutionDistrictUnavailable: true
  });
  const dom = new JSDOM(html);
  const summary = dom.window.document.querySelector('.main-district-summary');
  assert.match(summary.textContent, /ไม่สามารถโหลดจำนวนรายอำเภอ/);
  assert.equal(summary.querySelector('dl'), null);
  assert.equal(summary.querySelector('table'), null);
  dom.window.close();
});
