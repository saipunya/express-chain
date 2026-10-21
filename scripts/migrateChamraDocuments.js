// Run explicitly during deployment.
process.env.DB_SKIP_STARTUP_CHECK = '1';
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/migrations/20261021_create_chamra_documents.sql'), 'utf8');
  await db.query(sql);
  console.log('Chamra documents table installed.');
}
main().catch(err => {
  console.error('Chamra documents migration failed:', err.code || err.message);
  process.exitCode = 1;
}).finally(() => db.end());
