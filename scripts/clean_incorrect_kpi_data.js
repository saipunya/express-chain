const db = require('../config/db');

async function cleanIncorrectKpiData() {
  try {
    console.log('กำลังลบข้อมูล KPI ที่ไม่ถูกต้อง...');
    
    // ลบข้อมูลที่มีวันที่ผิดพลาด (report_month ที่ไม่ตรงกับเดือนจริง)
    const [result] = await db.query(
      `DELETE FROM plan_kpi_monthly 
       WHERE report_month >= '2025-10-01' 
       AND (
         (report_month LIKE '2025-11%' AND DATE_FORMAT(report_month, '%Y-%m') = '2025-12') OR
         (report_month LIKE '2025-12%' AND DATE_FORMAT(report_month, '%Y-%m') = '2026-01') OR
         (report_month LIKE '2026-01%' AND DATE_FORMAT(report_month, '%Y-%m') = '2026-02') OR
         (report_month LIKE '2026-02%' AND DATE_FORMAT(report_month, '%Y-%m') = '2026-03')
       )`
    );
    
    console.log(`ลบข้อมูลที่ผิดพลาด ${result.affectedRows} รายการ`);
    
    // แสดงข้อมูลที่เหลืออยู่
    const [remaining] = await db.query(
      `SELECT km.kp_id, pk.kp_subject, km.report_month, km.actual_value,
              DATE_FORMAT(km.report_month, '%Y-%m') as month_key
       FROM plan_kpi_monthly km
       INNER JOIN plan_kpi pk ON km.kp_id = pk.kp_id
       WHERE km.report_month >= '2025-10-01'
       ORDER BY km.report_month ASC, km.kp_id ASC`
    );
    
    console.log('\nข้อมูลที่เหลืออยู่หลังการลบ:');
    console.table(remaining);
    
    process.exit(0);
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    process.exit(1);
  }
}

cleanIncorrectKpiData();
