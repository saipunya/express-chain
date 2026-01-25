/* eslint-disable no-console */

const db = require('../config/db');

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
  const hasCol = await columnExists('plan_project', 'pro_respon_id');
  if (!hasCol) {
    await db.query('ALTER TABLE plan_project ADD COLUMN pro_respon_id INT NULL AFTER pro_respon');
    console.log('✅ Added column plan_project.pro_respon_id');
  } else {
    console.log('ℹ️  Column plan_project.pro_respon_id already exists');
  }

  const hasIdx = await indexExists('plan_project', 'idx_pro_respon_id');
  if (!hasIdx) {
    await db.query('ALTER TABLE plan_project ADD KEY idx_pro_respon_id (pro_respon_id)');
    console.log('✅ Added index idx_pro_respon_id');
  } else {
    console.log('ℹ️  Index idx_pro_respon_id already exists');
  }

  console.log('✅ plan_project respon migration complete');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  });
