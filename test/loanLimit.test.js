const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { JSDOM } = require('jsdom');
const calculate = require('../public/js/loan-limit');

test('CPMR formulas use the selected multiplier and sum all five commitments', () => {
  const debts = [100, 200, 300, 400, 500];
  assert.deepEqual(calculate('general', 10000, 2000, 1000, debts),
    { base: 11000, multiplier: 5, limit: 55000, committed: 1500 });
  assert.equal(calculate('savings', 10000, 2000, 1000, debts).limit, 16500);
  assert.equal(calculate('general', 100, 0, 200, debts).limit, -500);
  assert.equal(calculate('general', 0, 0, 0, [0, 0, 0, 0, 0]).limit, 0);
  for (const bad of [-1, NaN, Infinity]) {
    assert.throws(() => calculate('general', bad, 0, 0, debts));
  }
  assert.throws(() => calculate('unknown', 0, 0, 0, debts));
});

test('anonymous route renders and browser recalculates, invalidates and resets results', async t => {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.use((_req, res, next) => { res.locals.user = null; next(); });
  app.use('/loan-limit', require('../routes/loanLimitRoutes'));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/loan-limit`);
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text(), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../public/js/loan-limit.js'), 'utf8'));
  const { document, Event } = dom.window;
  const form = document.getElementById('loan-limit-form');
  const result = document.getElementById('loan-result');
  form.querySelectorAll('input').forEach(input => { input.value = '0'; });
  form.elements.capital.value = '1000';
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(result.hidden, false);
  assert.match(document.getElementById('result-limit').textContent, /5,000.00/);
  form.elements.coopType.value = 'savings';
  form.dispatchEvent(new Event('change'));
  assert.equal(result.hidden, true);
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.match(document.getElementById('result-limit').textContent, /1,500.00/);
  form.elements.loss.value = '2000';
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(document.getElementById('negative-base').hidden, false);
  form.reset();
  assert.equal(result.hidden, true);
});
