const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');
const { base, row } = require('./helpers/sangketViewFixtures');

async function render(t, name, overrides = {}) {
  const html = await ejs.renderFile(path.join(__dirname, '../views/sangket', `${name}.ejs`), { ...base, ...overrides });
  const dom = new JSDOM(html, { url: 'https://example.test/sangket', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  return dom;
}

test('sangket views render populated and empty states with consistent navigation', async (t) => {
  for (const name of ['index', 'report', 'form', 'view', 'cooperative', 'import']) {
    for (const empty of [false, true]) {
      const dom = await render(t, name, empty ? { items: [], observations: [], statusRows: [], dashboard: {}, cooperativeTotal: 0 } : {});
      assert.ok(dom.window.document.querySelector('nav[aria-label="ระบบข้อสังเกต"]'));
      assert.ok(dom.window.document.querySelector('h1'));
    }
  }
});

test('status shortcuts and filter forms preserve other active filters', async (t) => {
  for (const name of ['index', 'report']) {
    const filters = { ...base.filters, search: 'บัญชี', groupNo: 1, auditType: 'annual', coopType: 'cooperative', fiscalYearEnd: '2569' };
    const dom = await render(t, name, { filters });
    const doc = dom.window.document;
    const link = [...doc.querySelectorAll('a')].find(a => new URL(a.href).searchParams.get('status') === 'in_progress');
    const query = new URL(link.href).searchParams;
    assert.equal(query.get('search'), 'บัญชี');
    assert.equal(query.get('groupNo'), '1');
    for (const key of ['auditType', 'coopType', 'fiscalYearEnd']) {
      assert.equal(doc.querySelector(`form input[name="${key}"]`).value, filters[key]);
    }
  }
});

test('institution register shows total, resolved, in-progress and new issue counts', async (t) => {
  const dom = await render(t, 'index');
  const summary = dom.window.document.querySelector('.summary-grid').textContent;
  assert.match(summary, /ทั้งหมด\s*4/);
  assert.match(summary, /แก้ไขแล้ว\s*1/);
  assert.match(summary, /ระหว่างดำเนินการ\s*2/);
  assert.match(summary, /ยังไม่แก้ไข\s*1/);
});

test('institution detail keeps the summary and issue list compact', async (t) => {
  const observation = {
    ...row,
    actions: [{ id: 11, action_detail: 'ปรับปรุงเอกสารแล้ว', attachment_path: 'evidence.pdf', attachment_name: 'หลักฐาน.pdf' }]
  };
  const dom = await render(t, 'cooperative', { observations: [observation] });
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.status-stat').length, 4);
  assert.equal(doc.querySelectorAll('.issue-row').length, 1);
  assert.match(doc.querySelector('.issue-row').textContent, /นางสาวเจ้าหน้าที่ ตัวอย่าง/);
  assert.match(doc.querySelector('.issue-row').textContent, /ปรับปรุงเอกสารแล้ว/);
  assert.equal(doc.querySelector('.issue-row a[href="/sangket/view/7/actions/11/evidence"]').textContent.trim(), 'หลักฐาน.pdf');
  assert.doesNotMatch(doc.querySelector('.coop-shell').textContent, /ภาพรวมสหกรณ์|ปีบัญชี|มูลค่าความเสียหาย/);
});

test('create and edit forms keep submitted fields and institution selection working', async (t) => {
  for (const item of [null, row]) {
    const dom = await render(t, 'form', { item });
    const doc = dom.window.document;
    dom.window.eval(doc.querySelector('script:not([src])').textContent);
    const form = doc.querySelector('.form-shell form');
    assert.equal(form.getAttribute('action'), item ? '/sangket/edit/7' : '/sangket/create');
    assert.equal(form.querySelector('select[name="status"] option[value="in_progress"]').textContent, 'กำลังดำเนินการ');
    assert.equal(form.querySelectorAll('fieldset').length, 2);
    for (const name of ['cooperative_name', 'promotion_group_no', 'responsible_name', 'observation_text', 'status', 'remark']) assert.ok(form.elements.namedItem(name), name);
    if (!item) {
      doc.getElementById('coop_group_select').value = 'สหกรณ์';
      doc.getElementById('coop_group_select').dispatchEvent(new dom.window.Event('change'));
      doc.getElementById('c_group_select').value = 'กลุ่ม 1';
      doc.getElementById('c_group_select').dispatchEvent(new dom.window.Event('change'));
      doc.getElementById('c_name_select').value = '360001';
      doc.getElementById('c_name_select').dispatchEvent(new dom.window.Event('change'));
    }
    assert.equal(form.elements.namedItem('c_code').value, '360001');
    assert.equal(form.elements.namedItem('cooperative_name').value, row.cooperative_name);
    assert.equal(form.elements.namedItem('responsible_name').value, row.responsible_name);
    assert.equal(form.querySelector('button[type="submit"]').form, form);
    assert.equal(form.querySelector('[name="observation_text"]').required, true);
  }
});

test('detail page shows a simple correction report and evidence upload flow', async (t) => {
  const item = {
    ...row,
    actions: [{
      id: 11,
      action_detail: 'แก้ไขเอกสารเรียบร้อยแล้ว',
      created_by: 'เจ้าหน้าที่ส่งเสริม',
      attachment_path: 'evidence.pdf',
      attachment_name: 'หลักฐาน.pdf'
    }]
  };
  const dom = await render(t, 'view', { item });
  const doc = dom.window.document;
  assert.match(doc.querySelector('.view-shell').textContent, /กำลังดำเนินการ/);
  assert.ok(doc.querySelector('a[href="/sangket/cooperatives/3"]'));
  const form = doc.querySelector('form[action="/sangket/view/7/actions"]');
  assert.equal(form.getAttribute('enctype'), 'multipart/form-data');
  assert.equal(form.querySelector('[name="action_detail"]').required, true);
  assert.equal(form.querySelector('[name="evidence"]').required, true);
  assert.equal(form.querySelector('[name="status"]').value, 'in_progress');
  assert.match(doc.querySelector('.observation-card').textContent, /รายละเอียดข้อสังเกต/);
  assert.match(doc.querySelector('.observation-card').textContent, /นางสาวเจ้าหน้าที่ ตัวอย่าง/);
  assert.ok(doc.querySelector('a[href="/sangket/view/7/actions/11/evidence"]'));
  assert.match(doc.querySelector('#history-heading').parentElement.parentElement.textContent, /หลักฐาน\.pdf/);
});

test('index separates administrative controls and escapes institution names', async (t) => {
  const dom = await render(t, 'index', { items: [{ ...row, cooperative_name: '<img src=x onerror=alert(1)>' }] });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.coop-cell img'), null);
  assert.match(doc.querySelector('.coop-cell').textContent, /<img/);
  const clearForm = doc.querySelector('form[action="/sangket/clear-all"]');
  assert.ok(clearForm.closest('details'));
  assert.equal(clearForm.closest('details').open, false);
  const member = await render(t, 'index', { user: { level: 'staff' } });
  assert.equal(member.window.document.querySelector('form[action="/sangket/clear-all"]'), null);
});
