const PlanBudgetDisbursal = require('../models/planBudgetDisbursal');
const projectModel = require('../models/planProjectModel');
const thaiDate = require('../utils/thaiDate');

const DISBURSAL_TYPES = {
  activity: 'กิจกรรม',
  material: 'วัสดุ',
  labor: 'ค่าแรง',
  equipment: 'อุปกรณ์',
  other: 'อื่นๆ'
};

const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// ฟังก์ชันสำหรับแปลง ISO month ไป Thai
const toThaiMonthLabel = (yearMonth) => {
  if (!yearMonth) return '-';
  const [year, month] = yearMonth.split('-');
  const monthIndex = parseInt(month) - 1;
  const thaiYear = parseInt(year) + 543;
  return `${TH_MONTHS[monthIndex]} ${thaiYear}`;
};

/**
 * แสดงหน้ารายการการเบิกเงิน
 */
exports.list = async (req, res) => {
  try {
    const { pro_code } = req.query;
    
    if (!pro_code) {
      return res.status(400).send('Project code is required');
    }

    const project = await projectModel.getByCode(pro_code);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const disbursals = await PlanBudgetDisbursal.getByProjectId(project.pro_id);
    const monthlySummary = await PlanBudgetDisbursal.getMonthlySummary(project.pro_id);
    const monthlyWithBalance = await PlanBudgetDisbursal.getMonthlyWithBalance(
      project.pro_id,
      parseFloat(project.pro_budget) || 0
    );

    res.render('plan_project/budget_disbursal', {
      project,
      disbursals: disbursals.map(d => ({
        ...d,
        disbursal_date_formatted: thaiDate(d.disbursal_date),
        disbursal_type_label: DISBURSAL_TYPES[d.disbursal_type] || d.disbursal_type
      })),
      monthlySummary: monthlySummary.map(m => ({
        ...m,
        month_label: toThaiMonthLabel(m.month),
        total_amount_formatted: Number(m.total_amount).toLocaleString('th-TH', { maximumFractionDigits: 2 })
      })),
      monthlyWithBalance: monthlyWithBalance.map(m => ({
        ...m,
        month_label: toThaiMonthLabel(m.month),
        total_amount_formatted: Number(m.total_amount).toLocaleString('th-TH', { maximumFractionDigits: 2 }),
        cumulative_spent_formatted: Number(m.cumulative_spent).toLocaleString('th-TH', { maximumFractionDigits: 2 }),
        remaining_budget_formatted: Number(m.remaining_budget).toLocaleString('th-TH', { maximumFractionDigits: 2 })
      })),
      disbursal_types: DISBURSAL_TYPES,
      user: req.session.user || null,
      title: 'รายงานการเบิกเงิน - CoopChain'
    });
  } catch (error) {
    console.error('Error in planBudgetDisbursalController.list:', error);
    res.status(500).render('error_page', {
      message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลการเบิกเงิน'
    });
  }
};

/**
 * บันทึกการเบิกเงินใหม่
 */
exports.store = async (req, res) => {
  try {
    const {
      pro_code,
      disbursal_date,
      amount,
      description,
      disbursal_type,
      reference_no
    } = req.body;

    if (!pro_code || !disbursal_date || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const project = await projectModel.getByCode(pro_code);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await PlanBudgetDisbursal.create({
      pro_id: project.pro_id,
      disbursal_date,
      amount: parseFloat(amount),
      description,
      disbursal_type,
      reference_no,
      created_by: req.session.user?.m_id || 'system',
      created_at: new Date()
    });

    res.json({ 
      success: true, 
      message: 'บันทึกการเบิกเงินสำเร็จ',
      redirect: `/plan_project/budget_disbursal?pro_code=${encodeURIComponent(pro_code)}`
    });
  } catch (error) {
    console.error('Error in planBudgetDisbursalController.store:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึก' });
  }
};

/**
 * ลบการเบิกเงิน
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const { pro_code } = req.query;

    await PlanBudgetDisbursal.delete(id);

    res.json({ 
      success: true, 
      message: 'ลบการเบิกเงินสำเร็จ',
      redirect: `/plan_project/budget_disbursal?pro_code=${encodeURIComponent(pro_code)}`
    });
  } catch (error) {
    console.error('Error in planBudgetDisbursalController.delete:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบ' });
  }
};

/**
 * Export CSV รายงานการเบิกเงิน
 */
exports.exportCSV = async (req, res) => {
  try {
    const { pro_code } = req.query;

    const project = await projectModel.getByCode(pro_code);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const disbursals = await PlanBudgetDisbursal.getByProjectId(project.pro_id);
    const monthlyWithBalance = await PlanBudgetDisbursal.getMonthlyWithBalance(
      project.pro_id,
      parseFloat(project.pro_budget) || 0
    );

    // สร้าง CSV
    let csv = 'ลำดับ,วันที่เบิก,หมวดหมู่,รายละเอียด,จำนวนเงิน,เลขอ้างอิง\n';
    disbursals.forEach((d, index) => {
      csv += `${index + 1},${thaiDate(d.disbursal_date)},${DISBURSAL_TYPES[d.disbursal_type] || d.disbursal_type},"${d.description}",${d.amount},"${d.reference_no || '-'}"\n`;
    });

    csv += '\n\nสรุปตามเดือน\n';
    csv += 'เดือน,จำนวนการเบิก,รวมเงินที่เบิก,สะสมจนถึง,คงเหลือ\n';
    monthlyWithBalance.forEach(m => {
      csv += `${toThaiMonthLabel(m.month)},${m.count},${m.total_amount_formatted},${m.cumulative_spent_formatted},${m.remaining_budget_formatted}\n`;
    });

    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="budget_disbursal_${pro_code}.csv"`);
    res.send('\uFEFF' + csv); // BOM for proper encoding
  } catch (error) {
    console.error('Error in planBudgetDisbursalController.exportCSV:', error);
    res.status(500).send('Export failed');
  }
};
