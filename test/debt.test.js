'use strict';

process.env.DB_SKIP_STARTUP_CHECK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { memberRisk, parseFollowup } = require('../services/debtService');
const { canAccessCoop } = require('../services/debtAccessService');
const db = require('../config/db');

test.after(async () => {
  await db.end();
});

test('member risk follows documented thresholds', () => {
  assert.equal(memberRisk({ daysPastDue: 90 }), 'RED');
  assert.equal(memberRisk({ overdueInstallments: 3 }), 'RED');
  assert.equal(memberRisk({ daysPastDue: 31 }), 'ORANGE');
  assert.equal(memberRisk({ overdueInstallments: 2 }), 'ORANGE');
  assert.equal(memberRisk({ daysPastDue: 1 }), 'YELLOW');
  assert.equal(memberRisk({ daysToNextDue: 30 }), 'YELLOW');
  assert.equal(memberRisk({ daysToNextDue: 31 }), 'GREEN');
});

test('cooperative access cannot cross its backend scope', () => {
  assert.equal(canAccessCoop({ provinceWide: true, coopIds: [] }, 999), true);
  assert.equal(canAccessCoop({ provinceWide: false, coopIds: [14] }, 14), true);
  assert.equal(canAccessCoop({ provinceWide: false, coopIds: [14] }, 45), false);
});

test('follow-up validation rejects invalid values', () => {
  assert.throws(() => parseFollowup({ action_type: 'DROP', action_date: '2026-08-09' }, 'MEMBER'));
  assert.throws(() => parseFollowup({ action_type: 'PHONE', action_date: '09/08/2026' }, 'MEMBER'));
  assert.throws(() => parseFollowup({ action_type: 'PHONE', action_date: '2026-08-09', promised_amount: '-1' }, 'MEMBER'));
  const data = parseFollowup({ action_type: 'PHONE', action_date: '2026-08-09', followup_status: 'OPEN' }, 'MEMBER');
  assert.equal(data.actionType, 'PHONE');
});
