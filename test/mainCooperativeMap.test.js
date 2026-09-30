const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');

const template = path.join(__dirname, '../views/main.ejs');
const script = fs.readFileSync(path.join(__dirname, '../public/js/cooperative-map.js'), 'utf8');
const locations = [
  { code: 'TEST-1', name: 'สหกรณ์ทดสอบเมือง', type: 'agri', district: 'เมืองชัยภูมิ', address: 'ถนนทดสอบ', latitude: 15.8068, longitude: 102.0315, websiteUrl: 'https://example.org' },
  { code: 'TEST-2', name: 'สหกรณ์ออมทรัพย์ทดสอบ', type: 'non_agri', district: 'เมืองชัยภูมิ', latitude: 15.82, longitude: 102.04 },
  { code: 'TEST-3', name: 'กลุ่มเกษตรกรทดสอบ', type: 'farmer', district: 'ภูเขียว', latitude: 16.37, longitude: 102.12 }
];

async function page(t, data = {}) {
  const html = await ejs.renderFile(template, { title: 'ทดสอบแผนที่', user: null, returnTo: '', cooperativeMapLocations: locations, ...data });
  const document = new JSDOM(html);
  const section = document.window.document.getElementById('cooperativeMapSection');
  const dom = new JSDOM(section.outerHTML, { runScripts: 'outside-only', url: 'http://localhost/main' });
  document.window.close();
  t.after(() => dom.window.close());
  const $ = (selector) => dom.window.document.querySelector(selector);
  return { dom, $, start: () => dom.window.eval(script) };
}

function leafletStub(window) {
  const state = { active: [], all: [], center: null, bounds: null, tiles: {} };
  const map = {
    setView(center, zoom) { state.center = center; state.zoom = zoom; return this; },
    fitBounds(bounds) { state.bounds = bounds; return this; }
  };
  const layer = { addTo() { return this; }, clearLayers() { state.active = []; } };
  window.L = {
    map() { return map; },
    layerGroup() { return layer; },
    tileLayer() { return { on(event, callback) { state.tiles[event] = callback; return this; }, addTo() { return this; } }; },
    circleMarker(point) {
      const marker = {
        point,
        bindPopup(content) { this.popup = content; return this; },
        bindTooltip(content) { this.tooltip = content; return this; },
        addTo() { state.active.push(this); return this; },
        openPopup() { state.open = this; return this; }
      };
      state.all.push(marker);
      return marker;
    }
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  return state;
}

test('always renders the Chaiyaphum map and distinguishes empty data from failure', async (t) => {
  for (const unavailable of [false, true]) {
    const { $, start, dom } = await page(t, { cooperativeMapLocations: [], cooperativeMapUnavailable: unavailable });
    const state = leafletStub(dom.window);
    start();
    assert.ok($('#cooperativeMap'));
    assert.equal($('#cooperativeMapEmpty').hidden, false);
    assert.match($('#cooperativeMapEmpty').textContent, unavailable ? /ไม่พร้อมใช้งาน/ : /ยังไม่มีพิกัดที่เผยแพร่/);
    assert.equal(state.active.length, 0);
    assert.deepEqual(Array.from(state.center), [15.8068, 102.0315]);
  }
});

test('combines search, district and type filters and restores all results on reset', async (t) => {
  const { $, dom, start } = await page(t);
  const state = leafletStub(dom.window);
  start();
  assert.equal(state.active.length, 3);
  $('#cooperativeMapDistrict').value = 'เมืองชัยภูมิ';
  $('#cooperativeMapDistrict').dispatchEvent(new dom.window.Event('change'));
  assert.equal(state.active.length, 2);
  $('[data-map-filter="agri"]').click();
  assert.equal(state.active.length, 1);
  assert.equal($('[data-map-filter="agri"]').getAttribute('aria-pressed'), 'true');
  $('#cooperativeMapSearch').value = 'ถนนทดสอบ';
  $('#cooperativeMapSearch').dispatchEvent(new dom.window.Event('input'));
  assert.equal($('#cooperativeMapCount').textContent, '1');
  $('#cooperativeMapSearch').value = 'TEST-3';
  $('#cooperativeMapSearch').dispatchEvent(new dom.window.Event('input'));
  assert.equal(state.active.length, 0);
  assert.equal($('#cooperativeMapEmpty').hidden, false);
  assert.equal(dom.window.document.querySelectorAll('[data-map-result]:not([hidden])').length, 0);
  $('#cooperativeMapReset').click();
  assert.equal(state.active.length, 3);
  assert.equal($('#cooperativeMapSearch').value, '');
  assert.equal($('#cooperativeMapDistrict').value, '');
  assert.equal($('#cooperativeMapEmpty').hidden, true);
  assert.equal(dom.window.document.querySelectorAll('[data-map-result]:not([hidden])').length, 3);
  $('[data-map-location="2"]').click();
  assert.match(state.open.popup.textContent, /กลุ่มเกษตรกรทดสอบ/);
  assert.deepEqual(Array.from(state.center), [16.37, 102.12]);
});

test('keeps names, filtering and Google Maps links usable when Leaflet fails to load', async (t) => {
  const { $, dom, start } = await page(t);
  start();
  assert.equal($('#cooperativeMapWrap').classList.contains('map-error'), true);
  assert.equal($('#cooperativeMapSearch').disabled, false);
  $('[data-map-filter="farmer"]').click();
  assert.equal($('#cooperativeMapCount').textContent, '1');
  assert.equal(dom.window.document.querySelectorAll('[data-map-result]:not([hidden])').length, 1);
  const result = $('[data-map-result="2"]');
  assert.match(result.querySelector('a').href, /query=16.37%2C102.12/);
  assert.equal(result.querySelector('button').hidden, true);
});

test('escapes untrusted names in JSON, results, popups and tooltips and rejects unsafe locations', async (t) => {
  const malicious = '</script><img src=x onerror=alert(1)>';
  const { $, dom, start } = await page(t, { cooperativeMapLocations: [
    { ...locations[0], name: malicious, websiteUrl: 'javascript:alert(1)' },
    { ...locations[1], latitude: null },
    { ...locations[1], longitude: '' },
    { ...locations[2], latitude: 13.75, longitude: 100.5 }
  ] });
  const state = leafletStub(dom.window);
  start();
  assert.equal(state.active.length, 1);
  assert.equal($('#cooperativeMapList img'), null);
  assert.equal($('.main-coop-map-result-name').textContent, malicious);
  assert.equal(state.active[0].tooltip.textContent, malicious);
  assert.equal(state.active[0].tooltip.querySelector('img'), null);
  assert.equal(state.active[0].popup.querySelector('img'), null);
  assert.equal(state.active[0].popup.querySelectorAll('a').length, 1);
});

test('offers coordinate management only to permitted staff and renders links without JavaScript', async (t) => {
  for (const [user, allowed] of [[null, false], [{ mClass: 'viewer' }, false], [{ level: 'admin' }, true], [{ m_class: 'pbt' }, true], [{ mClass: 'admin', group: 'coop' }, false]]) {
    const { $ } = await page(t, { user });
    assert.equal(Boolean($('a[href="/cooperative-locations"]')), allowed);
    assert.equal($('.main-coop-map-result-actions a').getAttribute('rel'), 'noopener noreferrer');
    assert.equal($('a[href="https://example.org/"]').textContent.includes('เว็บไซต์'), true);
  }
});
