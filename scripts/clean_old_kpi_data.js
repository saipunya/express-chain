const db = require('../config/db');

async function cleanOldKpiData() {
  try {
    console.log('กำลังลบข้อมูล KPI เก่าก่อนปีงบประมาณ 2568...');
    
    // ลบข้อมูลก่อน 1 ตุลาคม 2025 (ก่อนเริ่มปีงบประมาณ 2568)
    const cutoffDate = '2025-10-01';
    
    const [result] = await db.query(
      `DELETE km FROM plan_kpi_monthly km
       INNER JOIN plan_kpi pk ON km.kp_id = pk.kp_id
       WHERE km.report_month < ?`,
      [cutoffDate]
    );
    
    console.log(`ลบข้อมูลเก่า ${result.affectedRows} รายการเรียบร้อยแล้ว`);
    
    // แสดงข้อมูลที่เหลืออยู่
    const [remaining] = await db.query(
      `SELECT km.kp_id, pk.kp_subject, km.report_month, km.actual_value
       FROM plan_kpi_monthly km
       INNER JOIN plan_kpi pk ON km.kp_id = pk.kp_id
       ORDER BY km.report_month DESC, km.kp_id ASC`
    );
    
    console.log('\nข้อมูลที่เหลืออยู่:');
    console.table(remaining);
    
    process.exit(0);
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    process.exit(1);
  }
}

cleanOldKpiData();
