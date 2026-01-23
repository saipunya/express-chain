/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const tableExists = async (tableName) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(row.c || 0) > 0;
};

const columnExists = async (tableName, columnName) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(row.c || 0) > 0;
};

const indexExists = async (tableName, indexName) => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(row.c || 0) > 0;
};

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'audit_log.sql'), 'utf8');
  await db.query(sql);

  const exists = await tableExists('audit_log');
  if (!exists) {
    throw new Error('audit_log table was not created');
  }

  const addColumns = [
    {
      name: 'entity_type',
      ddl: "ALTER TABLE audit_log ADD COLUMN entity_type VARCHAR(32) NULL AFTER session_id"
    },
    {
      name: 'entity_id',
      ddl: "ALTER TABLE audit_log ADD COLUMN entity_id VARCHAR(64) NULL AFTER entity_type"
    },
    {
      name: 'pro_code',
      ddl: "ALTER TABLE audit_log ADD COLUMN pro_code VARCHAR(50) NULL AFTER entity_id"
    },
    {
      name: 'ac_id',
      ddl: "ALTER TABLE audit_log ADD COLUMN ac_id INT NULL AFTER pro_code"
    },
    {
      name: 'kp_id',
      ddl: "ALTER TABLE audit_log ADD COLUMN kp_id INT NULL AFTER ac_id"
    }
  ];

  for (const col of addColumns) {
    // eslint-disable-next-line no-await-in-loop
    const has = await columnExists('audit_log', col.name);
    if (!has) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(col.ddl);
      console.log('✅ Added column', col.name);
    }
  }

  const addIndexes = [
    { name: 'idx_entity', ddl: 'ALTER TABLE audit_log ADD KEY idx_entity (entity_type, entity_id)' },
    { name: 'idx_pro_code', ddl: 'ALTER TABLE audit_log ADD KEY idx_pro_code (pro_code)' },
    { name: 'idx_ac_id', ddl: 'ALTER TABLE audit_log ADD KEY idx_ac_id (ac_id)' },
    { name: 'idx_kp_id', ddl: 'ALTER TABLE audit_log ADD KEY idx_kp_id (kp_id)' }
  ];

  for (const idx of addIndexes) {
    // eslint-disable-next-line no-await-in-loop
    const has = await indexExists('audit_log', idx.name);
    if (!has) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(idx.ddl);
      console.log('✅ Added index', idx.name);
    }
  }

  console.log('✅ audit_log migration complete');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  });
