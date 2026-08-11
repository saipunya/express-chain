'use strict';

const db = require('../config/db');

(async () => {
  const [[cdf]] = await db.query('SELECT borrower_cooperative_count,contract_count FROM cdf_v_provincial_dashboard');
  const [[member]] = await db.query('SELECT cooperatives_with_member_debt_data,borrower_members,active_loans FROM md_v_provincial_dashboard');
  const [[portal]] = await db.query('SELECT COUNT(*) account_count FROM md_member_portal_users WHERE active=1');
  const [[ownLoan]] = await db.query('SELECT COUNT(*) count FROM md_loans WHERE id=1 AND member_id=1');
  const [[foreignLoan]] = await db.query('SELECT COUNT(*) count FROM md_loans WHERE id=15 AND member_id=1');
  const expected = cdf.borrower_cooperative_count === 18 && cdf.contract_count === 33 && member.cooperatives_with_member_debt_data === 2 && member.borrower_members === 24 && member.active_loans === 28 && portal.account_count >= 2 && ownLoan.count === 1 && foreignLoan.count === 0;
  console.log({ cdf, memberDebt: member, memberPortalAccounts: portal.account_count, memberLoanScope: { own: ownLoan.count, foreign: foreignLoan.count }, status: expected ? 'PASS' : 'FAIL' });
  await db.end();
  if (!expected) process.exit(1);
})().catch(async (error) => { console.error(error.message); await db.end(); process.exit(1); });
