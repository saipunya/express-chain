'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/db');

const password = process.env.DEBT_DEMO_MEMBER_PASSWORD || 'Demo@2569';
const accounts = [
  { memberId: 1, username: 'demo-bh-0001' },
  { memberId: 13, username: 'demo-nb-0001' }
];

(async () => {
  const hash = await bcrypt.hash(password, 12);
  for (const account of accounts) {
    const [[member]] = await db.query('SELECT id,demo_flag FROM md_members WHERE id=?', [account.memberId]);
    if (!member?.demo_flag) throw new Error(`Member ${account.memberId} is not demo data; refusing to seed credentials`);
    await db.query(`INSERT INTO md_member_portal_users(member_id,username,password_hash,active,must_change_password)
      VALUES (?,?,?,1,0)
      ON DUPLICATE KEY UPDATE username=VALUES(username),password_hash=VALUES(password_hash),active=1,must_change_password=0`,
    [account.memberId, account.username, hash]);
  }
  console.log({ accounts: accounts.map(({ username }) => username), password, warning: 'Demo accounts only' });
  await db.end();
})().catch(async (error) => { console.error(error.message); await db.end(); process.exit(1); });
