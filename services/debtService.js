'use strict';

const repository = require('../repositories/debtRepository');
const { canEditFollowup } = require('./debtAccessService');
const riskConfig = require('../config/debtRisk');

const MEMBER_ACTIONS = new Set(['PHONE','LETTER','FIELD_VISIT','MEETING','RESTRUCTURE','LEGAL','OTHER']);
const CDF_ACTIONS = new Set(['FUND_USE_INSPECTION','DEBT_WARNING','FOLLOW_UP','FIELD_VISIT','PHONE','LETTER','RESTRUCTURE','OTHER']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function memberRisk({ daysPastDue = 0, overdueInstallments = 0, daysToNextDue = null }) {
  const rules = riskConfig.memberDebt;
  if (Number(daysPastDue) >= rules.redDaysPastDue || Number(overdueInstallments) >= rules.redOverdueInstallments) return 'RED';
  if (Number(daysPastDue) >= rules.orangeDaysPastDue || Number(overdueInstallments) === rules.orangeOverdueInstallments) return 'ORANGE';
  if (Number(daysPastDue) >= 1 || Number(overdueInstallments) === 1 || (daysToNextDue !== null && Number(daysToNextDue) >= 0 && Number(daysToNextDue) <= 30)) return 'YELLOW';
  return 'GREEN';
}

function validDate(value, required = false) {
  if (!value) return !required;
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseFollowup(body, domain) {
  const actionType = cleanText(body.action_type, 50);
  const allowed = domain === 'CDF' ? CDF_ACTIONS : MEMBER_ACTIONS;
  const statusAllowed = domain === 'CDF' ? new Set(['PLANNED','COMPLETED','CANCELLED']) : new Set(['OPEN','DONE','CANCELLED']);
  const actionDate = cleanText(body.action_date, 10);
  const nextFollowUpDate = cleanText(body.next_follow_up_date, 10);
  const promiseDate = cleanText(body.promise_date, 10);
  const promisedAmount = body.promised_amount === '' || body.promised_amount == null ? null : Number(body.promised_amount);
  if (!allowed.has(actionType)) throw Object.assign(new Error('ประเภทการติดตามไม่ถูกต้อง'), { status: 400 });
  if (!validDate(actionDate, true) || !validDate(nextFollowUpDate) || !validDate(promiseDate)) {
    throw Object.assign(new Error('วันที่ไม่ถูกต้อง'), { status: 400 });
  }
  if (promisedAmount !== null && (!Number.isFinite(promisedAmount) || promisedAmount < 0)) {
    throw Object.assign(new Error('จำนวนเงินตามคำมั่นต้องเป็นเลขที่ไม่ติดลบ'), { status: 400 });
  }
  const status = cleanText(body.followup_status || (domain === 'CDF' ? 'COMPLETED' : 'OPEN'), 20);
  if (!statusAllowed.has(status)) throw Object.assign(new Error('สถานะการติดตามไม่ถูกต้อง'), { status: 400 });
  return {
    actionType, status, actionDate, nextFollowUpDate: nextFollowUpDate || null,
    promiseDate: promiseDate || null, promisedAmount,
    resultNote: cleanText(body.result_note, 4000)
  };
}

async function addMemberFollowup(loanId, body, access) {
  if (!canEditFollowup(access)) throw Object.assign(new Error('ไม่มีสิทธิ์บันทึกการติดตาม'), { status: 403 });
  const detail = await repository.getLoan(loanId, access);
  if (!detail) throw Object.assign(new Error('ไม่พบสัญญา หรือไม่มีสิทธิ์เข้าถึง'), { status: 404 });
  return repository.createMemberFollowup(loanId, parseFollowup(body, 'MEMBER'));
}

async function addCdfFollowup(contractId, body, access) {
  if (!canEditFollowup(access)) throw Object.assign(new Error('ไม่มีสิทธิ์บันทึกการติดตาม'), { status: 403 });
  const detail = await repository.getCdfContract(contractId, access);
  if (!detail) throw Object.assign(new Error('ไม่พบสัญญา หรือไม่มีสิทธิ์เข้าถึง'), { status: 404 });
  return repository.createCdfFollowup(contractId, parseFollowup(body, 'CDF'));
}

module.exports = { memberRisk, parseFollowup, addMemberFollowup, addCdfFollowup };
