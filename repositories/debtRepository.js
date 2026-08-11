'use strict';

const db = require('../config/db');

function scopeClause(access, column = 'coop_id') {
  if (access.provinceWide) return { sql: '', params: [] };
  if (!access.coopIds.length) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${column} IN (?)`, params: [access.coopIds] };
}

async function one(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

async function all(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function getProvinceSummary(access) {
  const cdfScope = scopeClause(access, 'coop_id');
  const mdScope = scopeClause(access, 'coop_id');
  const [cdf] = await db.query(`SELECT COUNT(DISTINCT coop_id) borrower_cooperative_count,
    COUNT(*) contract_count, COALESCE(SUM(contract_amount),0) total_contract_amount,
    COALESCE(SUM(latest_principal_balance),0) total_principal_balance,
    SUM(BINARY risk_color=BINARY 'RED') red_contracts, SUM(BINARY risk_color=BINARY 'ORANGE') orange_contracts,
    MAX(COALESCE(next_due_date,maturity_date)) as_of_date
    FROM cdf_v_contract_status WHERE 1=1${cdfScope.sql}`, cdfScope.params);
  const [md] = await db.query(`SELECT COUNT(DISTINCT coop_id) cooperatives_with_member_debt_data,
    COUNT(DISTINCT member_id) borrower_members, COUNT(DISTINCT loan_id) active_loans,
    COALESCE(SUM(principal_balance),0) total_principal_balance, COALESCE(SUM(total_overdue),0) total_overdue,
    SUM(BINARY risk_color=BINARY 'RED') red_loans, SUM(BINARY risk_color=BINARY 'ORANGE') orange_loans,
    SUM(urgent_no_recent_followup) urgent_no_recent_followup, MAX(next_due_date) as_of_date
    FROM md_v_member_debt_status WHERE 1=1${mdScope.sql}`, mdScope.params);
  return { cdf: cdf[0], memberDebt: md[0] };
}

async function listUrgentTasks(access, limit = 12) {
  const cdfScope = scopeClause(access, 'coop_id');
  const mdScope = scopeClause(access, 'coop_id');
  const cdf = await all(`SELECT 'CDF' domain_name, contract_id item_id, coop_id, c_name, contract_no item_no,
    risk_color, COALESCE(next_due_date,maturity_date) due_date,
    CASE WHEN BINARY risk_color=BINARY 'RED' THEN 4 ELSE 2 END priority_score,
    CASE WHEN BINARY risk_color=BINARY 'RED' THEN 'เกินกำหนดชำระ' ELSE 'ใกล้ครบกำหนด' END reason
    FROM cdf_v_contract_status WHERE BINARY risk_color IN (BINARY 'RED',BINARY 'ORANGE')${cdfScope.sql}
    ORDER BY CASE WHEN BINARY risk_color=BINARY 'RED' THEN 1 ELSE 2 END, due_date LIMIT ?`, [...cdfScope.params, limit]);
  const md = await all(`SELECT 'MEMBER' domain_name, loan_id item_id, coop_id, c_name, loan_no item_no,
    risk_color, next_followup_date due_date, attention_reason reason, member_id, display_name
    ,CASE WHEN urgent_no_recent_followup=1 THEN 5 WHEN BINARY risk_color=BINARY 'RED' THEN 4 ELSE 3 END priority_score
    FROM md_v_member_debt_status WHERE (BINARY risk_color IN (BINARY 'RED',BINARY 'ORANGE') OR urgent_no_recent_followup=1)${mdScope.sql}
    ORDER BY urgent_no_recent_followup DESC, risk_score DESC, total_overdue DESC LIMIT ?`, [...mdScope.params, limit]);
  return [...cdf, ...md]
    .sort((a, b) => Number(b.priority_score) - Number(a.priority_score) || new Date(a.due_date || '9999-12-31') - new Date(b.due_date || '9999-12-31'))
    .slice(0, limit);
}

async function listCdfCooperatives(access) {
  const scope = scopeClause(access, 'coop_id');
  return all(`SELECT * FROM cdf_v_cooperative_dashboard WHERE contract_count > 0${scope.sql}
    ORDER BY red_contracts DESC, orange_contracts DESC, total_contract_amount DESC`, scope.params);
}

async function listCdfContracts(access, filters = {}) {
  const scope = scopeClause(access, 'coop_id');
  const params = [...scope.params];
  let filter = '';
  if (['RED','ORANGE','YELLOW','GREEN','UNKNOWN'].includes(filters.risk)) { filter += ' AND BINARY risk_color=BINARY ?'; params.push(filters.risk); }
  if (filters.coopId) { filter += ' AND coop_id=?'; params.push(Number(filters.coopId)); }
  return all(`SELECT * FROM cdf_v_contract_status WHERE 1=1${scope.sql}${filter}
    ORDER BY CASE BINARY risk_color WHEN BINARY 'RED' THEN 1 WHEN BINARY 'ORANGE' THEN 2 WHEN BINARY 'YELLOW' THEN 3 WHEN BINARY 'GREEN' THEN 4 ELSE 5 END, COALESCE(next_due_date,maturity_date)`, params);
}

async function getCooperative(coopId) {
  return one('SELECT * FROM active_coop WHERE c_id=?', [coopId]);
}

async function getCdfContract(contractId, access) {
  const scope = scopeClause(access, 'v.coop_id');
  const contract = await one(`SELECT v.*, lc.purpose, lc.lifecycle_status, lc.source_scope, lc.notes
    FROM cdf_v_contract_status v JOIN cdf_loan_contracts lc ON lc.id=v.contract_id
    WHERE v.contract_id=?${scope.sql}`, [contractId, ...scope.params]);
  if (!contract) return null;
  const [schedules, ledger, actions, issues] = await Promise.all([
    all('SELECT * FROM cdf_loan_due_schedules WHERE contract_id=? ORDER BY due_date', [contractId]),
    all('SELECT * FROM cdf_loan_ledger_entries WHERE contract_id=? ORDER BY entry_date DESC,id DESC', [contractId]),
    all('SELECT * FROM cdf_monitoring_actions WHERE contract_id=? ORDER BY COALESCE(action_date,planned_date) DESC,id DESC', [contractId]),
    all("SELECT * FROM cdf_data_quality_issues WHERE contract_id=? ORDER BY CASE BINARY resolution_status WHEN BINARY 'OPEN' THEN 1 WHEN BINARY 'REVIEWED' THEN 2 WHEN BINARY 'RESOLVED' THEN 3 ELSE 4 END,id DESC", [contractId])
  ]);
  return { contract, schedules, ledger, actions, issues };
}

async function listMemberDebtCooperatives(access) {
  const scope = scopeClause(access, 'coop_id');
  return all(`SELECT * FROM md_v_cooperative_dashboard WHERE 1=1${scope.sql}
    ORDER BY red_loans DESC, orange_loans DESC, total_overdue DESC`, scope.params);
}

async function listMemberDebt(access, filters = {}) {
  const scope = scopeClause(access, 'coop_id');
  const params = [...scope.params];
  let filter = '';
  if (filters.coopId) { filter += ' AND coop_id=?'; params.push(Number(filters.coopId)); }
  if (['RED','ORANGE','YELLOW','GREEN'].includes(filters.risk)) { filter += ' AND BINARY risk_color=BINARY ?'; params.push(filters.risk); }
  if (filters.q) { filter += ' AND (member_no LIKE ? OR display_name LIKE ? OR loan_no LIKE ?)'; const q=`%${filters.q}%`; params.push(q,q,q); }
  return all(`SELECT * FROM md_v_member_debt_status WHERE 1=1${scope.sql}${filter}
    ORDER BY risk_score DESC,total_overdue DESC,display_name`, params);
}

async function getMember(memberId, access) {
  const scope = scopeClause(access, 'm.coop_id');
  const member = await one(`SELECT m.*,c.c_code,c.c_name,c.c_person responsible_officer
    FROM md_members m JOIN active_coop c ON c.c_id=m.coop_id WHERE m.id=?${scope.sql}`, [memberId, ...scope.params]);
  if (!member) return null;
  const loans = await all('SELECT s.*,l.contract_date,l.maturity_date,l.annual_interest_rate,l.installment_amount FROM md_v_member_debt_status s JOIN md_loans l ON l.id=s.loan_id WHERE s.member_id=? ORDER BY s.risk_score DESC', [memberId]);
  return { member, loans };
}

async function getLoan(loanId, access) {
  const scope = scopeClause(access, 's.coop_id');
  const loan = await one(`SELECT s.*,l.contract_date,l.maturity_date,l.annual_interest_rate,l.installment_amount,l.loan_status,m.demo_flag
    FROM md_v_member_debt_status s JOIN md_loans l ON l.id=s.loan_id JOIN md_members m ON m.id=s.member_id
    WHERE s.loan_id=?${scope.sql}`, [loanId, ...scope.params]);
  if (!loan) return null;
  const [snapshots, payments, followups] = await Promise.all([
    all('SELECT * FROM md_debt_snapshots WHERE loan_id=? ORDER BY snapshot_date DESC,id DESC', [loanId]),
    all('SELECT * FROM md_payments WHERE loan_id=? ORDER BY payment_date DESC,id DESC', [loanId]),
    all('SELECT * FROM md_followups WHERE loan_id=? ORDER BY action_date DESC,id DESC', [loanId])
  ]);
  return { loan, snapshots, payments, followups };
}

async function createMemberFollowup(loanId, data) {
  const [result] = await db.query(`INSERT INTO md_followups
    (loan_id,action_date,action_type,result_note,promise_date,promised_amount,next_follow_up_date,followup_status)
    VALUES (?,?,?,?,?,?,?,?)`, [loanId,data.actionDate,data.actionType,data.resultNote||null,data.promiseDate||null,data.promisedAmount||null,data.nextFollowUpDate||null,data.status]);
  return result.insertId;
}

async function createCdfFollowup(contractId, data) {
  const [result] = await db.query(`INSERT INTO cdf_monitoring_actions
    (contract_id,action_type,action_status,action_date,result_note,next_follow_up_date)
    VALUES (?,?,?,?,?,?)`, [contractId,data.actionType,data.status,data.actionDate,data.resultNote||null,data.nextFollowUpDate||null]);
  return result.insertId;
}

module.exports = {
  getProvinceSummary, listUrgentTasks, listCdfCooperatives, listCdfContracts, getCooperative,
  getCdfContract, listMemberDebtCooperatives, listMemberDebt, getMember, getLoan,
  createMemberFollowup, createCdfFollowup
};
