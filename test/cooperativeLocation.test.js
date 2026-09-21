process.env.DB_SKIP_STARTUP_CHECK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const locationService = require('../services/cooperativeLocationService');
const { createRouter } = require('../routes/cooperativeLocationRoutes');
const db = require('../config/db');

function createMemoryStore() {
  const institutions = [
    { c_code: 'CP-001', c_name: 'สหกรณ์การเกษตรเมืองชัยภูมิ จำกัด', coop_group: 'สหกรณ์', in_out_group: 'ในภาค', c_group: 'การเกษตร' },
    { c_code: 'CP-002', c_name: 'สหกรณ์ออมทรัพย์ตัวอย่าง จำกัด', coop_group: 'สหกรณ์', in_out_group: 'นอกภาค', c_group: 'ออมทรัพย์' },
    { c_code: 'CP-XSS', c_name: '<script>alert(1)</script>', coop_group: 'กลุ่มเกษตรกร', in_out_group: '', c_group: '' }
  ];
  const rows = [];
  const enrich = (row) => ({ ...row, ...institutions.find((item) => item.c_code === row.c_code), ...row });
  return {
    rows,
    async list(search = '') {
      const keyword = search.toLowerCase();
      return rows.map(enrich).filter((item) => !keyword || `${item.c_code} ${item.c_name} ${item.district}`.toLowerCase().includes(keyword));
    },
    async getById(id) { const row = rows.find((item) => String(item.id) === String(id)); return row ? enrich(row) : null; },
    async getByCode(code) { return rows.find((item) => item.c_code === code) || null; },
    async listInstitutions() { return institutions; },
    async create(values, updatedBy) { const id = rows.length + 1; rows.push({ id, ...values, updated_by: updatedBy }); return id; },
    async update(id, values, updatedBy) {
      const index = rows.findIndex((item) => String(item.id) === String(id));
      if (index < 0) return 0;
      rows[index] = { ...rows[index], ...values, updated_by: updatedBy };
      return 1;
    }
  };
}

test('parses Google Maps coordinates and normalizes safe URLs', () => {
  assert.deepEqual(locationService.parseCoordinates('15.8068, 102.0315'), { latitude: 15.8068, longitude: 102.0315 });
  assert.deepEqual(locationService.parseCoordinates('https://www.google.com/maps/place/test/@15.812345,102.041234,17z'), { latitude: 15.812345, longitude: 102.041234 });
  assert.deepEqual(locationService.parseCoordinates('https://www.google.com/maps/search/?api=1&query=15.7%2C102.2'), { latitude: 15.7, longitude: 102.2 });
  assert.equal(locationService.parseCoordinates('https://maps.app.goo.gl/short-code'), null);

  const result = locationService.normalize({
    c_code: 'CP-001', latitude: '15.8068', longitude: '102.0315', website_url: 'example.org/path',
    google_maps_url: 'https://www.google.co.th/maps/@15.8068,102.0315,17z', is_verified: '1', is_public: '1'
  });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.website_url, 'https://example.org/path');
  assert.equal(result.values.is_public, true);
});

test('rejects unsafe links, coordinates outside Chaiyaphum, and unverified publication', () => {
  let result = locationService.normalize({ c_code: 'CP-001', latitude: '13.7563', longitude: '100.5018', website_url: 'javascript:alert(1)' });
  assert.match(result.errors.latitude, /นอกบริเวณจังหวัดชัยภูมิ/);
  assert.match(result.errors.website_url, /http/);
  result = locationService.normalize({ c_code: 'CP-001', latitude: '15.8', longitude: '102.03', google_maps_url: 'https://example.com/maps', is_public: '1' });
  assert.match(result.errors.google_maps_url, /Google Maps/);
  assert.match(result.errors.is_public, /ยืนยันพิกัด/);
});

test('admin and pbt can add and edit locations through protected forms', async (t) => {
  const store = createMemoryStore();
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.use(express.urlencoded({ extended: true }));
  app.use(session({ secret: 'test-location-session', resave: false, saveUninitialized: false }));
  app.get('/test-login', (req, res) => {
    req.session.user = { id: '1', username: 'tester', fullname: 'เจ้าหน้าที่ทดสอบ', mClass: req.query.role || 'admin', group: 'cpd' };
    res.send('ok');
  });
  app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });
  app.use('/cooperative-locations', createRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options = {}) => fetch(origin + route, { redirect: 'manual', ...options });
  const login = async (role) => (await request(`/test-login?role=${role}`)).headers.get('set-cookie').split(';')[0];
  const post = (route, cookie, body) => request(route, {
    method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body)
  });

  assert.equal((await request('/cooperative-locations')).status, 302);
  const viewerCookie = await login('viewer');
  assert.match(await (await request('/cooperative-locations', { headers: { cookie: viewerCookie } })).text(), /ไม่ได้รับอนุญาต|ไม่ได้เข้าหน้านี้/);

  const cookie = await login('pbt');
  let response = await request('/cooperative-locations/new', { headers: { cookie } });
  assert.equal(response.status, 200);
  let html = await response.text();
  assert.match(html, /วางลิงก์ Google Maps หรือพิกัด/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  const token = html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

  response = await post('/cooperative-locations', cookie, { _csrf: 'bad' });
  assert.equal(response.status, 403);
  response = await post('/cooperative-locations', cookie, { _csrf: token, c_code: 'CP-001', latitude: '15.8068', longitude: '102.0315', is_public: '1' });
  assert.equal(response.status, 422);
  assert.equal(store.rows.length, 0);

  response = await post('/cooperative-locations', cookie, {
    _csrf: token, c_code: 'CP-001', latitude: '15.8068', longitude: '102.0315', district: 'เมืองชัยภูมิ',
    google_maps_url: 'https://www.google.com/maps/@15.8068,102.0315,17z', website_url: 'coop.example.org', is_verified: '1', is_public: '1'
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/cooperative-locations?saved=1');
  assert.equal(store.rows[0].website_url, 'https://coop.example.org/');

  html = await (await request('/cooperative-locations?saved=1', { headers: { cookie } })).text();
  assert.match(html, /บันทึกข้อมูลพิกัดเรียบร้อยแล้ว/);
  assert.match(html, /สหกรณ์การเกษตรเมืองชัยภูมิ/);
  assert.match(html, /https:\/\/coop\.example\.org\//);

  html = await (await request('/cooperative-locations/1/edit', { headers: { cookie } })).text();
  const editToken = html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  response = await post('/cooperative-locations/1', cookie, {
    _csrf: editToken, c_code: 'CP-001', latitude: '15.81', longitude: '102.04', district: 'บ้านเขว้า', website_url: 'https://new.example.org', is_verified: '1'
  });
  assert.equal(response.status, 303);
  assert.equal(store.rows[0].district, 'บ้านเขว้า');
  assert.equal(store.rows[0].is_public, false);
});

test.after(async () => { await db.end(); });
