'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const zipPath = process.argv[2];
if (!zipPath) {
  console.error('Usage: node scripts/installDebtDemo.js /absolute/path/coop_monitoring_codex_handoff.zip');
  process.exit(1);
}

const entries = [
  'coop_monitoring_codex_handoff/database/10_cdf_module_active_coop_2569.sql',
  'coop_monitoring_codex_handoff/database/20_member_debt_demo_2coops.sql'
];

function readZipEntry(entry) {
  return execFileSync('unzip', ['-p', zipPath, entry], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
}

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    multipleStatements: true
  });
  try {
    const [[activeCoop]] = await connection.query("SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='active_coop'");
    if (!activeCoop.count) throw new Error('ไม่พบ active_coop ในฐานข้อมูลปัจจุบัน');
    const [existing] = await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND (table_name LIKE 'cdf\\_%' OR table_name LIKE 'md\\_%')");
    if (existing.length) throw new Error(`ยกเลิกเพื่อความปลอดภัย: พบ object ของโมดูลหนี้อยู่แล้ว ${existing.length} รายการ`);
    for (const entry of entries) {
      await connection.query(readZipEntry(entry));
      console.log(`Installed ${entry.split('/').pop()}`);
    }
    await connection.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '20260809_create_md_member_portal_users.sql'), 'utf8'));
    const demoPassword = process.env.DEBT_DEMO_MEMBER_PASSWORD || 'Demo@2569';
    const demoHash = await bcrypt.hash(demoPassword, 12);
    for (const account of [{ memberId: 1, username: 'demo-bh-0001' }, { memberId: 13, username: 'demo-nb-0001' }]) {
      await connection.query('INSERT INTO md_member_portal_users(member_id,username,password_hash,active,must_change_password) VALUES (?,?,?,1,0)', [account.memberId, account.username, demoHash]);
    }
    const [[cdf]] = await connection.query('SELECT borrower_cooperative_count,contract_count FROM cdf_v_provincial_dashboard');
    const [[member]] = await connection.query('SELECT borrower_members,active_loans FROM md_v_provincial_dashboard');
    console.log({ cdf, memberDebt: member, demoMemberAccounts: ['demo-bh-0001', 'demo-nb-0001'] });
  } finally {
    await connection.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
