// Run explicitly during deployment; never runs when the application starts.
process.env.DB_SKIP_STARTUP_CHECK = '1';
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/migrations/20261019_create_chamra_management.sql'), 'utf8');
  const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  const conn = await db.getConnection();
  try {
    // MySQL DDL commits implicitly. Create tables first, then seed in a transaction.
    for (const statement of statements.filter(s => s.startsWith('CREATE TABLE'))) await conn.query(statement);
    await conn.beginTransaction();
    try {
      for (const statement of statements.filter(s => !s.startsWith('CREATE TABLE'))) await conn.query(statement);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
    console.log('Chamra management tables and fiscal year 2569 data installed.');
  } finally {
    conn.release();
  }
}
main().catch(err => {
  console.error('Chamra migration failed:', err.code || err.message);
  process.exitCode = 1;
}).finally(() => db.end());
