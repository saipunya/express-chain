const test = require('node:test');
const assert = require('node:assert/strict');
const options = require('../utils/surveyOptions');
const utils = require('../utils/surveyUtils');
const service = require('../services/surveyService');

test('parseJsonArray handles strings, arrays and malformed data', () => {
  assert.deepEqual(utils.parseJsonArray('["A","B"]'), ['A', 'B']);
  assert.deepEqual(utils.parseJsonArray(['A']), ['A']);
  assert.deepEqual(utils.parseJsonArray('not-json'), []);
});

test('selection validation rejects values outside allow-list', () => {
  assert.throws(() => utils.allowedArray(['ไม่ใช่ตัวเลือก'], options.aiJobs), /INVALID_CHOICE/);
  assert.equal(utils.allowedSingle('สนใจ', options.aiInterests, true), 'สนใจ');
});

test('buildResponse stores cooperative snapshot and JSON arrays', () => {
  const response = service.buildResponse({
    coop_type: options.coopTypes[0], tech_level: '3', ai_interest: 'สนใจ',
    pilot_readiness: 'พร้อม', current_tools: [options.currentTools[0]]
  }, { c_id: 7, c_name: 'สหกรณ์ทดสอบ' }, { ip: '127.0.0.1', userAgent: 'test' });
  assert.equal(response.coop_id, 7);
  assert.equal(response.coop_name, 'สหกรณ์ทดสอบ');
  assert.equal(response.tech_level, 3);
  assert.equal(response.current_tools, JSON.stringify([options.currentTools[0]]));
});

test('buildResponse accepts a manually entered cooperative name', () => {
  const response = service.buildResponse({
    coop_name: 'กลุ่มเกษตรกรตัวอย่าง', coop_type: 'กลุ่มเกษตรกร', tech_level: '2',
    ai_interest: 'ยังไม่แน่ใจ', pilot_readiness: 'ต้องการพิจารณาก่อน'
  }, null, { ip: '127.0.0.1', userAgent: 'test' });
  assert.equal(response.coop_id, null);
  assert.equal(response.coop_name, 'กลุ่มเกษตรกรตัวอย่าง');
});

test('buildResponse requires a manually entered cooperative name', () => {
  assert.throws(() => service.buildResponse({
    coop_type: 'กลุ่มเกษตรกร', tech_level: '2', ai_interest: 'สนใจ', pilot_readiness: 'พร้อม'
  }, null, {}), /COOP_NAME_REQUIRED/);
});

test('summary calculates unique cooperatives, percentages and rankings', () => {
  const summary = service.summarize([
    { coop_id: 1, ai_interest: 'สนใจ', pilot_readiness: 'พร้อม', current_problems: '["ข้อมูลซ้ำซ้อน"]', tech_level: 3, coop_type: 'A' },
    { coop_id: 1, ai_interest: 'ไม่สนใจ', pilot_readiness: 'ยังไม่พร้อม', current_problems: '["ข้อมูลซ้ำซ้อน","ค้นหาข้อมูลยาก"]', tech_level: 2, coop_type: 'A' }
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.uniqueCoops, 1);
  assert.equal(summary.aiInterestedPercent, 50);
  assert.equal(summary.pilotReadyPercent, 50);
  assert.deepEqual(summary.currentProblems[0], { label: 'ข้อมูลซ้ำซ้อน', count: 2 });
});
