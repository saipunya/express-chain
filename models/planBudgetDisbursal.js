const db = require('../config/db');

// ดึงข้อมูลการเบิกเงินทั้งหมดของโครงการ
exports.getByProjectId = async (projectId) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM plan_budget_disbursal 
       WHERE pro_id = ? 
       ORDER BY disbursal_date DESC`,
      [projectId]
    );
    return rows || [];
  } catch (error) {
    console.error('Error fetching budget disbursal:', error);
    throw error;
  }
};

// ดึงข้อมูลการเบิกเงินตามเดือน
exports.getByProjectAndMonth = async (projectId, reportMonth) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM plan_budget_disbursal 
       WHERE pro_id = ? AND YEAR_MONTH(disbursal_date) = ?
       ORDER BY disbursal_date ASC`,
      [projectId, reportMonth]
    );
    return rows || [];
  } catch (error) {
    console.error('Error fetching monthly budget disbursal:', error);
    throw error;
  }
};

// ดึงข้อมูลการเบิกเงินแบบสรุปตามเดือน
exports.getMonthlySummary = async (projectId) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        DATE_FORMAT(disbursal_date, '%Y-%m') as month,
        SUM(amount) as total_amount,
        COUNT(*) as count,
        GROUP_CONCAT(description) as descriptions
       FROM plan_budget_disbursal 
       WHERE pro_id = ?
       GROUP BY DATE_FORMAT(disbursal_date, '%Y-%m')
       ORDER BY month DESC`,
      [projectId]
    );
    return rows || [];
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    throw error;
  }
};

// บันทึกการเบิกเงินใหม่
exports.create = async (data) => {
  const {
    pro_id,
    disbursal_date,
    amount,
    description,
    disbursal_type, // e.g., 'activity', 'material', 'labor'
    reference_no,
    created_by,
    created_at
  } = data;

  try {
    const [result] = await db.query(
      `INSERT INTO plan_budget_disbursal 
        (pro_id, disbursal_date, amount, description, disbursal_type, reference_no, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pro_id, disbursal_date, amount, description, disbursal_type, reference_no, created_by, created_at]
    );
    return result;
  } catch (error) {
    console.error('Error creating budget disbursal:', error);
    throw error;
  }
};

// อัปเดตการเบิกเงิน
exports.update = async (id, data) => {
  const {
    disbursal_date,
    amount,
    description,
    disbursal_type,
    reference_no,
    updated_by,
    updated_at
  } = data;

  try {
    const [result] = await db.query(
      `UPDATE plan_budget_disbursal 
       SET disbursal_date = ?, amount = ?, description = ?, disbursal_type = ?, 
           reference_no = ?, updated_by = ?, updated_at = ?
       WHERE id = ?`,
      [disbursal_date, amount, description, disbursal_type, reference_no, updated_by, updated_at, id]
    );
    return result;
  } catch (error) {
    console.error('Error updating budget disbursal:', error);
    throw error;
  }
};

// ลบการเบิกเงิน
exports.delete = async (id) => {
  try {
    const [result] = await db.query(
      `DELETE FROM plan_budget_disbursal WHERE id = ?`,
      [id]
    );
    return result;
  } catch (error) {
    console.error('Error deleting budget disbursal:', error);
    throw error;
  }
};

// ดึงข้อมูลการเบิกเงินตามเดือนพร้อมคำนวณยอดคงเหลือ
exports.getMonthlyWithBalance = async (projectId, totalBudget) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        DATE_FORMAT(disbursal_date, '%Y-%m') as month,
        DATE_FORMAT(disbursal_date, '%Y') as year,
        DATE_FORMAT(disbursal_date, '%m') as month_num,
        SUM(amount) as total_amount,
        COUNT(*) as count
       FROM plan_budget_disbursal 
       WHERE pro_id = ?
       GROUP BY DATE_FORMAT(disbursal_date, '%Y-%m')
       ORDER BY year DESC, month_num DESC`,
      [projectId]
    );
    
    // คำนวณยอดคงเหลือ
    let cumulativeSpent = 0;
    const withBalance = rows.map(row => {
      cumulativeSpent += parseFloat(row.total_amount) || 0;
      return {
        ...row,
        total_amount: parseFloat(row.total_amount) || 0,
        cumulative_spent: cumulativeSpent,
        remaining_budget: Math.max(0, totalBudget - cumulativeSpent)
      };
    });
    
    return withBalance;
  } catch (error) {
    console.error('Error getting monthly with balance:', error);
    throw error;
  }
};
