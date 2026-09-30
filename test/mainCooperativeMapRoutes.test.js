process.env.DB_SKIP_STARTUP_CHECK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../config/db');
const activeCoop = require('../models/activeCoopModel');
const bigmeet = require('../models/bigmeetModel');
const online = require('../models/onlineModel');
const turnover = require('../models/turnoverModel');
const strength = require('../models/strengthModel');
const downloads = require('../models/downModel');
const chamra = require('../models/chamraModel');
const locations = require('../models/cooperativeLocationModel');
const router = require('../routes/homeRoutes');
const showMain = router.stack.find((layer) => layer.route?.path === '/main').route.stack.at(-1).handle;

function stubSummaries(t) {
  [
    [activeCoop, 'getMeetingDeadlineBase', []], [activeCoop, 'getActiveInstitutionSummaryRows', []],
    [activeCoop, 'getInstitutionDistrictCounts', []],
    [bigmeet, 'findByCodes', []], [bigmeet, 'getLatestFiscalYearCategorySummary', { categories: [] }],
    [online, 'getOnlineUsers', []], [online, 'getOnlineCount', 0],
    [turnover, 'getCategorySummaryByFiscalYear', []], [strength, 'getGradeSummaryByInOutGroup', []],
    [downloads, 'getMainDownloads', []], [chamra, 'getAll', []]
  ].forEach(([model, method, value]) => t.mock.method(model, method, async () => value));
  t.mock.method(console, 'error', () => {});
}

test('main retains published map locations when another dashboard summary fails', async (t) => {
  stubSummaries(t);
  t.mock.method(activeCoop, 'getActiveInstitutionSummaryRows', async () => { throw new Error('summary unavailable'); });
  const published = [{ code: 'TEST-1', name: 'สหกรณ์ทดสอบ', latitude: 15.8, longitude: 102.03 }];
  t.mock.method(locations, 'getPublicMapLocations', async () => published);
  t.mock.method(activeCoop, 'getInstitutionDistrictCounts', async () => [{ district: 'เมืองชัยภูมิ', cooperatives: '2', farmerGroups: '1' }]);
  let rendered;
  await showMain({ session: {}, path: '/main' }, { render(view, data) { rendered = { view, data }; } });
  assert.equal(rendered.view, 'main');
  assert.deepEqual(rendered.data.cooperativeMapLocations, published);
  assert.equal(rendered.data.cooperativeMapUnavailable, false);
  assert.deepEqual(rendered.data.institutionDistrictSummary.totals, { cooperatives: 2, farmerGroups: 1, total: 3 });
  assert.equal(rendered.data.institutionDistrictUnavailable, false);
});

test('a district query failure does not prevent other main summaries from rendering', async (t) => {
  stubSummaries(t);
  t.mock.method(activeCoop, 'getInstitutionDistrictCounts', async () => { throw new Error('district unavailable'); });
  t.mock.method(activeCoop, 'getActiveInstitutionSummaryRows', async () => [{ c_code: 'TEST-1', c_name: 'สหกรณ์ทดสอบ', coop_group: 'สหกรณ์' }]);
  t.mock.method(locations, 'getPublicMapLocations', async () => []);
  let rendered;
  await showMain({ session: {}, path: '/main' }, { render(_view, data) { rendered = data; } });
  assert.equal(rendered.institutionDistrictUnavailable, true);
  assert.equal(rendered.institutionSummary.agri.count, 1);
  assert.equal(rendered.cooperativeMapUnavailable, false);
});

test('main distinguishes unavailable map data from a successful empty response', async (t) => {
  stubSummaries(t);
  const mapMock = t.mock.method(locations, 'getPublicMapLocations', async () => []);
  let rendered;
  const res = { render(_view, data) { rendered = data; } };
  await showMain({ session: {}, path: '/main' }, res);
  assert.equal(rendered.cooperativeMapUnavailable, false);
  assert.deepEqual(rendered.cooperativeMapLocations, []);
  mapMock.mock.mockImplementation(async () => { throw new Error('map unavailable'); });
  await showMain({ session: {}, path: '/main' }, res);
  assert.equal(rendered.cooperativeMapUnavailable, true);
  assert.deepEqual(rendered.cooperativeMapLocations, []);
});

test.after(async () => { await db.end(); });
