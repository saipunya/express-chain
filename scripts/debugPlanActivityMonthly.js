/* eslint-disable no-console */

const db = require('../config/db');

async function main() {
  const [[{ dbName }]] = await db.query('SELECT DATABASE() AS dbName');
  console.log('DB:', dbName);

  const [cols] = await db.query(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'plan_activity_monthly'
     ORDER BY ORDINAL_POSITION`
  );
  console.log('\nColumns plan_activity_monthly');
  console.table(cols);

  const [idx] = await db.query(
    `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'plan_activity_monthly'
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`
  );
  console.log('\nIndexes plan_activity_monthly');
  console.table(idx);

  const [sample] = await db.query(
    `SELECT pam.*
     FROM plan_activity_monthly pam
     JOIN plan_activity pa ON pa.ac_id = pam.ac_id
     WHERE pa.ac_procode = 'p101'
       AND pam.report_month = '2026-01-01'
     ORDER BY pam.updated_at DESC, pam.id DESC
     LIMIT 20`
  );
  console.log('\nRows for p101 / 2026-01-01:', sample.length);
  console.table(sample);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
