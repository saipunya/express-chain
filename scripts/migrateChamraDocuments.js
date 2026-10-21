// Run explicitly during deployment.
process.env.DB_SKIP_STARTUP_CHECK = '1';
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../sql/migrations/20261021_create_chamra_documents.sql'), 'utf8');
  await db.query(sql);
  await db.query(fs.readFileSync(path.join(__dirname, '../sql/migrations/20261021_create_chamra_auditor_images.sql'), 'utf8'));
  const flags = fs.readFileSync(path.join(__dirname, '../sql/migrations/20261021_add_chamra_document_flags.sql'), 'utf8');
  for (const statement of flags.split(';').map(s => s.trim()).filter(Boolean)) {
    try { await db.query(statement); }
    catch (err) { if (err.code !== 'ER_DUP_FIELDNAME') throw err; }
  }
  console.log('Chamra documents table and display options installed.');
}
main().catch(err => {
  console.error('Chamra documents migration failed:', err.code || err.message);
  process.exitCode = 1;
}).finally(() => db.end());
