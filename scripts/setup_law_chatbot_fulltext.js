const db = require('../config/db');

async function ensureIndex(tableName, indexName, columns) {
  const [rows] = await db.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);

  if (rows.length > 0) {
    console.log(`ข้าม: ${tableName}.${indexName} มีอยู่แล้ว`);
    return;
  }

  await db.query(`ALTER TABLE ${tableName} ADD FULLTEXT INDEX ${indexName} (${columns})`);
  console.log(`สำเร็จ: เพิ่ม FULLTEXT index ${tableName}.${indexName}`);
}

async function run() {
  try {
    await ensureIndex('tbl_laws', 'ft_tbl_laws_detail_search', 'law_detail, law_search');
    await ensureIndex('tbl_glaws', 'ft_tbl_glaws_detail', 'glaw_detail');
    console.log('ตั้งค่า FULLTEXT สำหรับ law chatbot เรียบร้อย');
    process.exit(0);
  } catch (error) {
    console.error('ตั้งค่า FULLTEXT ไม่สำเร็จ:', error.message);
    process.exit(1);
  }
}

run();
