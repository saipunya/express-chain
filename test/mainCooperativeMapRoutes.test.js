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
const meetingRooms = require('../models/meetingRoomModel');
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
    [meetingRooms, 'getTodayBangkok', { date: '2026-11-07', rows: [] }],
    [meetingRooms, 'getUpcoming', []],
    [strength, 'getLatestYear', 2569], [downloads, 'getMainDownloads', []], [chamra, 'getAll', []]
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
  assert.equal(rendered.data.mainUnavailable.institutions, true);
  assert.equal(rendered.data.mainUnavailable.strength, undefined);
  assert.equal(rendered.data.strengthGradeSummary.year, 2569);
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

test('main loads today and five upcoming room bookings and isolates loading errors', async (t) => {
  stubSummaries(t);
  t.mock.method(locations, 'getPublicMapLocations', async () => []);
  const today = {date: '2026-11-07', rows: [{mee_id: 1, mee_subject: 'Today'}]};
  t.mock.method(meetingRooms, 'getTodayBangkok', async () => today);
  t.mock.method(meetingRooms, 'getUpcoming', async limit => {
    assert.equal(limit, 5);
    return [{mee_id: 2, mee_subject: 'Next'}];
  });
  let rendered;
  const res = {render(_view, data) {rendered = data;}};
  await showMain({session: {}, path: '/main'}, res);
  assert.deepEqual(rendered.meetingRoomSummary.today, today.rows);
  assert.equal(rendered.meetingRoomSummary.upcoming.length, 1);
  t.mock.method(meetingRooms, 'getTodayBangkok', async () => {throw new Error('unavailable');});
  await showMain({session: {}, path: '/main'}, res);
  assert.equal(rendered.mainUnavailable.meetingRooms, true);
  assert.deepEqual(rendered.meetingRoomSummary.today, []);
  assert.equal(rendered.cooperativeMapUnavailable, false);
});

test.after(async () => { await db.end(); });
