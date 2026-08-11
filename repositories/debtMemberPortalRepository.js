'use strict';

const db = require('../config/db');

async function findAccountByUsername(username) {
  const [rows] = await db.query(`SELECT u.*,m.coop_id,m.member_no,m.display_name,m.demo_flag,c.c_name,c.c_code
    FROM md_member_portal_users u
    JOIN md_members m ON m.id=u.member_id
    JOIN active_coop c ON c.c_id=m.coop_id
    WHERE BINARY u.username=BINARY ? LIMIT 1`, [username]);
  return rows[0] || null;
}

async function recordFailedLogin(id) {
  await db.query(`UPDATE md_member_portal_users
    SET failed_login_attempts=failed_login_attempts+1,
        locked_until=CASE WHEN failed_login_attempts+1>=5 THEN DATE_ADD(NOW(),INTERVAL 15 MINUTE) ELSE locked_until END
    WHERE id=?`, [id]);
}

async function recordSuccessfulLogin(id) {
  await db.query('UPDATE md_member_portal_users SET failed_login_attempts=0,locked_until=NULL,last_login_at=NOW() WHERE id=?', [id]);
}

async function getMemberOverview(memberId) {
  const [members] = await db.query(`SELECT m.id,m.coop_id,m.member_no,m.display_name,m.member_group,m.member_status,m.demo_flag,
    c.c_code,c.c_name,c.c_person responsible_officer
    FROM md_members m JOIN active_coop c ON c.c_id=m.coop_id WHERE m.id=? LIMIT 1`, [memberId]);
  if (!members[0]) return null;
  const [loans] = await db.query(`SELECT s.*,l.contract_date,l.maturity_date,l.annual_interest_rate,l.installment_amount,l.loan_status
    FROM md_v_member_debt_status s JOIN md_loans l ON l.id=s.loan_id
    WHERE s.member_id=? ORDER BY s.risk_score DESC,s.loan_no`, [memberId]);
  const [[snapshot]] = await db.query(`SELECT MAX(ds.snapshot_date) as_of_date
    FROM md_debt_snapshots ds JOIN md_loans l ON l.id=ds.loan_id WHERE l.member_id=?`, [memberId]);
  return { member: members[0], loans, asOfDate: snapshot.as_of_date };
}

async function getLoanForMember(loanId, memberId) {
  const [rows] = await db.query(`SELECT s.*,l.contract_date,l.maturity_date,l.annual_interest_rate,l.installment_amount,l.loan_status,m.demo_flag
    FROM md_v_member_debt_status s
    JOIN md_loans l ON l.id=s.loan_id
    JOIN md_members m ON m.id=s.member_id
    WHERE s.loan_id=? AND s.member_id=? LIMIT 1`, [loanId, memberId]);
  const loan = rows[0];
  if (!loan) return null;
  const [snapshots, payments] = await Promise.all([
    db.query('SELECT snapshot_date,principal_balance,overdue_principal,overdue_interest,overdue_penalty,overdue_installments,days_past_due,next_due_date FROM md_debt_snapshots WHERE loan_id=? ORDER BY snapshot_date DESC,id DESC', [loanId]).then(([result]) => result),
    db.query('SELECT payment_date,principal_paid,interest_paid,penalty_paid,receipt_no,note FROM md_payments WHERE loan_id=? ORDER BY payment_date DESC,id DESC', [loanId]).then(([result]) => result)
  ]);
  return { loan, snapshots, payments };
}

module.exports = { findAccountByUsername, recordFailedLogin, recordSuccessfulLogin, getMemberOverview, getLoanForMember };
