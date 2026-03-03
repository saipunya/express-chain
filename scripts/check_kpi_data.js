const db = require('../config/db');

async function checkKpiData() {
  try {
    console.log('ตรวจสอบข้อมูล KPI ทั้งหมดในปีงบประมาณ 2568...');
    
    // ตรวจสอบข้อมูลทั้งหมดตั้งแต่ 1 ตุลาคม 2025 เป็นต้นไป
    const [rows] = await db.query(
      `SELECT km.kp_id, pk.kp_subject, km.report_month, km.actual_value,
              DATE_FORMAT(km.report_month, '%Y-%m') as month_key
       FROM plan_kpi_monthly km
       INNER JOIN plan_kpi pk ON km.kp_id = pk.kp_id
       WHERE km.report_month >= '2025-10-01'
       ORDER BY km.report_month ASC, km.kp_id ASC`
    );
    
    console.log('\nข้อมูล KPI ในปีงบประมาณ 2568:');
    console.table(rows);
    
    // ตรวจสอบข้อมูลโดยละเอียดตามเดือน
    const monthlyData = {};
    rows.forEach(row => {
      if (!monthlyData[row.month_key]) {
        monthlyData[row.month_key] = [];
      }
      monthlyData[row.month_key].push(row);
    });
    
    console.log('\nสรุปข้อมูลตามเดือน:');
    Object.keys(monthlyData).forEach(month => {
      console.log(`\nเดือน ${month}:`);
      monthlyData[month].forEach(row => {
        console.log(`  KPI ${row.kp_id}: ${row.actual_value}`);
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    process.exit(1);
  }
}

checkKpiData();
