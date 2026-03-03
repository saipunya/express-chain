const db = require('../config/db');

async function resetFiscalYearData() {
  try {
    console.log('กำลังลบข้อมูล KPI ทั้งหมดในปีงบประมาณ 2568...');
    
    // ลบข้อมูล KPI ทั้งหมดตั้งแต่ 1 ตุลาคม 2025 เป็นต้นไป
    const [result] = await db.query(
      `DELETE FROM plan_kpi_monthly 
       WHERE report_month >= '2025-10-01'`
    );
    
    console.log(`ลบข้อมูล KPI ในปีงบประมาณ 2568 ทั้งหมด ${result.affectedRows} รายการ`);
    
    // ตรวจสอบข้อมูลที่เหลืออยู่
    const [remaining] = await db.query(
      `SELECT km.kp_id, pk.kp_subject, km.report_month, km.actual_value,
              DATE_FORMAT(km.report_month, '%Y-%m') as month_key
       FROM plan_kpi_monthly km
       INNER JOIN plan_kpi pk ON km.kp_id = pk.kp_id
       ORDER BY km.report_month DESC, km.kp_id ASC
       LIMIT 10`
    );
    
    console.log('\nข้อมูลล่าสุดที่เหลืออยู่:');
    if (remaining.length === 0) {
      console.log('ไม่มีข้อมูล KPI ในระบบ');
    } else {
      console.table(remaining);
    }
    
    console.log('\n✅ พร้อมเริ่มต้นปีงบประมาณ 2568 ใหม่อย่างสะอาด!');
    console.log('เดือนตุลาคม 2568: ผลสะสม = 0');
    console.log('เดือนพฤศจิกายน 2568: ผลสะสม = 0 (ถ้ายังไม่มีการบันทึกเดือนตุลาคม)');
    
    process.exit(0);
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    process.exit(1);
  }
}

resetFiscalYearData();
