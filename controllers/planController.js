const db = require('../config/db');

// Cache for fiscal year calculations
const fiscalYearCache = new Map();

const TH_MONTHS = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม'
];

const TH_SHORT_MONTHS = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.'
];

// Helper Functions
const validateFiscalYear = (fy) => {
    const year = Number(fy);
    return Number.isInteger(year) && year >= 2500 && year <= 2700;
};

const toThaiMonthLabel = (value) => {
    if (!value) {
        return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const monthIndex = value.getMonth();
        const monthName = TH_MONTHS[monthIndex] || String(monthIndex + 1).padStart(2, '0');
        const buddhistYear = year + 543;
        return `${monthName} ${buddhistYear}`;
    }

    if (typeof value === 'string' && value.length >= 7) {
        const [year, month] = value.split('-');
        const monthIndex = Number(month) - 1;
        const monthName = TH_MONTHS[monthIndex] || month;
        const buddhistYear = Number(year) + 543;
        return `${monthName} ${buddhistYear}`;
    }

    return String(value);
};

const toThaiMonthShortLabel = (value) => {
    if (!value) {
        return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const monthIndex = value.getMonth();
        const monthName = TH_SHORT_MONTHS[monthIndex] || String(monthIndex + 1).padStart(2, '0');
        const buddhistYear = year + 543;
        return `${monthName} ${buddhistYear}`;
    }

    if (typeof value === 'string' && value.length >= 7) {
        const [year, month] = value.split('-');
        const monthIndex = Number(month) - 1;
        const monthName = TH_SHORT_MONTHS[monthIndex] || month;
        const buddhistYear = Number(year) + 543;
        return `${monthName} ${buddhistYear}`;
    }

    return String(value);
};

const getCurrentFiscalYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 10 ? year + 543 : year + 542;
};

const buildFiscalRange = (fiscalYear) => {
    if (!Number.isFinite(fiscalYear)) {
        return null;
    }
    const buddhistYear = fiscalYear;
    const christianYear = buddhistYear - 543;
    const startDate = new Date(christianYear, 9, 1);
    const endDate = new Date(christianYear + 1, 8, 30);
    const startMonth = `${christianYear}-10-01`;
    const endMonth = `${christianYear + 1}-09-30`;
    return { startDate, endDate, startMonth, endMonth };
};

const getCachedFiscalMonths = (fiscalYear) => {
    if (fiscalYearCache.has(fiscalYear)) {
        return fiscalYearCache.get(fiscalYear);
    }
    
    const fiscalRange = buildFiscalRange(fiscalYear);
    if (!fiscalRange) return [];
    
    const { startDate, endDate } = fiscalRange;
    const months = [];
    const pointer = new Date(startDate);
    
    while (pointer <= endDate) {
        const iso = pointer.toISOString().slice(0, 10);
        months.push({
            iso,
            label: toThaiMonthLabel(iso),
            shortLabel: toThaiMonthShortLabel(iso)
        });
        pointer.setMonth(pointer.getMonth() + 1);
    }
    
    fiscalYearCache.set(fiscalYear, months);
    return months;
};

// Database Query Functions
const getBasicStatistics = async () => {
    const [stats] = await db.query(`
        SELECT 
            (SELECT COUNT(*) FROM plan_main) AS total_plans,
            (SELECT COUNT(*) FROM plan_project) AS total_projects,
            (SELECT COUNT(*) FROM plan_activity) AS total_activities,
            (SELECT COUNT(*) FROM plan_kpi) AS total_kpis
    `);
    return stats[0] || {};
};

const getStatusStatistics = async () => {
    const [projectStatusRows] = await db.query(
        'SELECT pro_status, COUNT(*) AS cnt FROM plan_project GROUP BY pro_status'
    );
    const [activityStatusRows] = await db.query(
        'SELECT ac_status, COUNT(*) AS cnt FROM plan_activity GROUP BY ac_status'
    );

    const projectStatus = { notStarted: 0, inProgress: 0, done: 0 };
    projectStatusRows.forEach((r) => {
        if (r.pro_status === 2) projectStatus.done = r.cnt;
        else if (r.pro_status === 1) projectStatus.inProgress = r.cnt;
        else projectStatus.notStarted = r.cnt;
    });

    const activityStatus = { notStarted: 0, inProgress: 0, done: 0 };
    activityStatusRows.forEach((r) => {
        if (r.ac_status === 2) activityStatus.done = r.cnt;
        else if (r.ac_status === 1) activityStatus.inProgress = r.cnt;
        else activityStatus.notStarted = r.cnt;
    });

    return { projectStatus, activityStatus };
};

const getPlanOverview = async () => {
    const [planOverview] = await db.query(
        `SELECT m.ma_id, m.ma_code, m.ma_subject,
                        COUNT(DISTINCT p.pro_id) AS project_count,
                        SUM(CASE WHEN p.pro_status = 2 THEN 1 ELSE 0 END) AS done_projects
         FROM plan_main m
         LEFT JOIN plan_project p ON p.pro_macode = m.ma_code
         GROUP BY m.ma_id, m.ma_code, m.ma_subject
         ORDER BY m.ma_code`
    );
    return planOverview;
};

const getProjectReportingData = async () => {
    const projectReportingSql =
        `SELECT
                p.pro_id,
                p.pro_code,
                p.pro_subject AS pro_name,
                p.pro_budget,
                COALESCE(act.total_activities, 0) AS total_activities,
                COALESCE(act.completed_activities, 0) AS completed_activities,
                act.latest_activity_month,
                COALESCE(kpi.total_kpis, 0) AS total_kpis,
                COALESCE(kpi.total_plan, 0) AS total_plan,
                COALESCE(kpi.cumulative_actual, 0) AS cumulative_actual,
                kpi.latest_report_month
            FROM plan_project p
        LEFT JOIN (
            SELECT
                a.ac_procode,
                COUNT(DISTINCT a.ac_id) AS total_activities,
                COUNT(DISTINCT IF(a.ac_status = 2, a.ac_id, NULL)) AS completed_activities,
                MAX(am.report_month) AS latest_activity_month
            FROM plan_activity a
            LEFT JOIN plan_activity_monthly am ON am.ac_id = a.ac_id
            GROUP BY a.ac_procode
        ) AS act ON act.ac_procode = p.pro_code
        LEFT JOIN (
            SELECT
                k.kp_procode,
                COUNT(k.kp_id) AS total_kpis,
                SUM(k.kp_plan) AS total_plan,
                SUM(m.actual_value) AS cumulative_actual,
                MAX(m.report_month) AS latest_report_month
            FROM plan_kpi k
            LEFT JOIN plan_kpi_monthly m ON m.kp_id = k.kp_id
            GROUP BY k.kp_procode
        ) AS kpi ON kpi.kp_procode = p.pro_code
        ORDER BY p.pro_code`;

    const [projectReportingRows] = await db.query(projectReportingSql);

    return projectReportingRows.map((row) => {
        const totalPlan = Number(row.total_plan || 0);
        const cumulative = Number(row.cumulative_actual || 0);
        const achievementPercent = totalPlan > 0 ? (cumulative / totalPlan) * 100 : null;
        return {
            ...row,
            budget: Number(row.pro_budget || 0),
            achievementPercent,
            latestKpiLabel: toThaiMonthLabel(row.latest_report_month),
            latestActivityLabel: toThaiMonthLabel(row.latest_activity_month)
        };
    });
};

const getMonthlyOperationData = async (startMonth, endMonth) => {
    const operationMonthsMap = {};
    const addOperationMonth = (proId, month) => {
        if (!proId || !month) return;
        const normalized = month.trim().slice(0, 7);
        if (!normalized) return;
        if (!operationMonthsMap[proId]) {
            operationMonthsMap[proId] = new Set();
        }
        operationMonthsMap[proId].add(normalized);
    };

    const [activityMonthRows] = await db.query(
        `SELECT p.pro_id, LEFT(am.report_month, 7) AS month
         FROM plan_activity_monthly am
         JOIN plan_activity a ON a.ac_id = am.ac_id
         JOIN plan_project p ON p.pro_code = a.ac_procode
         WHERE LEFT(am.report_month, 7) BETWEEN ? AND ?
         GROUP BY p.pro_id, month`,
        [startMonth, endMonth]
    );
    activityMonthRows.forEach((row) => addOperationMonth(row.pro_id, row.month));

    const [kpiMonthRows] = await db.query(
        `SELECT p.pro_id, LEFT(km.report_month, 7) AS month
         FROM plan_kpi_monthly km
         JOIN plan_kpi k ON k.kp_id = km.kp_id
         JOIN plan_project p ON p.pro_code = k.kp_procode
         WHERE LEFT(km.report_month, 7) BETWEEN ? AND ?
         GROUP BY p.pro_id, month`,
        [startMonth, endMonth]
    );
    kpiMonthRows.forEach((row) => addOperationMonth(row.pro_id, row.month));

    return operationMonthsMap;
};

const getBudgetDisbursalData = async (startDate, endDate) => {
    const [disbursalRows] = await db.query(
        `SELECT p.pro_id, DATE_FORMAT(b.disbursal_date, '%Y-%m') AS month, SUM(b.amount) AS total_amount
         FROM plan_budget_disbursal b
         JOIN plan_project p ON p.pro_id = b.pro_id
         WHERE b.disbursal_date BETWEEN ? AND ?
         GROUP BY p.pro_id, month`,
        [startDate, endDate]
    );
    
    const disbursalMap = {};
    disbursalRows.forEach((row) => {
        if (!row.pro_id || !row.month) return;
        const normalized = row.month.trim().slice(0, 7);
        if (!normalized) return;
        const amount = Number(row.total_amount || 0);
        if (!disbursalMap[row.pro_id]) {
            disbursalMap[row.pro_id] = {};
        }
        disbursalMap[row.pro_id][normalized] = amount;
    });
    
    return disbursalMap;
};

const getKpiItemsData = async (projectReporting) => {
    const allProCodes = projectReporting.map(p => p.pro_code).filter(Boolean);
    let kpiItemsMap = {};

    if (allProCodes.length) {
        const placeholders = allProCodes.map(() => '?').join(',');
        const [kpiRows] = await db.query(
            `SELECT
                k.kp_id,
                k.kp_procode,
                k.kp_subject  AS kpi_name,
                k.kp_unit     AS unit,
                k.kp_plan     AS target,
                COALESCE(SUM(m.actual_value), 0) AS actual,
                CASE
                    WHEN k.kp_plan > 0
                    THEN ROUND(COALESCE(SUM(m.actual_value), 0) / k.kp_plan * 100, 2)
                    ELSE 0
                END AS percent
            FROM plan_kpi k
            LEFT JOIN plan_kpi_monthly m ON m.kp_id = k.kp_id
            WHERE k.kp_procode IN (${placeholders})
            GROUP BY k.kp_id, k.kp_procode, k.kp_subject, k.kp_unit, k.kp_plan
            ORDER BY k.kp_procode, k.kp_number`,
            allProCodes
        );

        kpiRows.forEach(row => {
            if (!kpiItemsMap[row.kp_procode]) kpiItemsMap[row.kp_procode] = [];
            kpiItemsMap[row.kp_procode].push({
                kp_id:    row.kp_id,
                kpi_name: row.kpi_name,
                unit:     row.unit,
                target:   Number(row.target || 0),
                actual:   Number(row.actual  || 0),
                percent:  Number(row.percent  || 0)
            });
        });
    }

    return kpiItemsMap;
};

// Main Controller Function
exports.index = async function (req, res) {
    try {
        // Input validation
        const requestedFy = Number.parseInt(String(req.query.fy ?? ''), 10);
        if (requestedFy && !validateFiscalYear(requestedFy)) {
            return res.status(400).render('error', { 
                message: 'ปีงบประมาณไม่ถูกต้อง (ต้องอยู่ระหว่าง 2500-2700)',
                title: 'ข้อผิดพลาด'
            });
        }

        const currentFy = getCurrentFiscalYear();
        const selectedFiscalYear = Number.isFinite(requestedFy) ? requestedFy : currentFy;
        const fiscalRange = buildFiscalRange(selectedFiscalYear);
        
        if (!fiscalRange) {
            throw new Error('Invalid fiscal year');
        }
        
        const { startDate, endDate, startMonth, endMonth } = fiscalRange;
        const fiscalMonths = getCachedFiscalMonths(selectedFiscalYear);
        const fiscalRangeLabel = `${toThaiMonthLabel(startMonth)} – ${toThaiMonthLabel(endMonth)}`;
        
        const fiscalYearOptions = Array.from({ length: 5 }, (_, idx) => {
            const fy = currentFy - idx;
            return {
                label: `ปีงบประมาณ ${fy}`,
                value: fy
            };
        });
        
        if (!fiscalYearOptions.some((option) => option.value === selectedFiscalYear)) {
            fiscalYearOptions.push({ label: `ปีงบประมาณ ${selectedFiscalYear}`, value: selectedFiscalYear });
        }
        fiscalYearOptions.sort((a, b) => b.value - a.value);

        // Parallel data fetching
        const [
            basicStats,
            statusStats,
            planOverview,
            projectReporting,
            operationMonthsMap,
            disbursalMap
        ] = await Promise.all([
            getBasicStatistics(),
            getStatusStatistics(),
            getPlanOverview(),
            getProjectReportingData(),
            getMonthlyOperationData(startMonth, endMonth),
            getBudgetDisbursalData(startDate, endDate)
        ]);

        // Process monthly status for each project
        const projectReportingWithMonths = projectReporting.map((project) => {
            let cumulativeSpent = 0;
            const monthlyStatus = fiscalMonths.map((month) => {
                const monthKey = (month.iso || '').slice(0, 7);
                const operationsReported = operationMonthsMap[project.pro_id]?.has(monthKey) || false;
                const monthlyAmount = disbursalMap[project.pro_id]?.[monthKey] || 0;
                cumulativeSpent += monthlyAmount;
                return {
                    ...month,
                    operationsReported,
                    disbursedAmount: monthlyAmount,
                    cumulativeSpent,
                    remainingBudget: Math.max(0, (project.budget || 0) - cumulativeSpent)
                };
            });
            
            const monthlyStatusMap = monthlyStatus.reduce((acc, entry) => {
                acc[entry.iso] = entry;
                return acc;
            }, {});
            
            return {
                ...project,
                monthlyStatus,
                monthlyStatusMap
            };
        });

        // Get KPI items for all projects
        const kpiItemsMap = await getKpiItemsData(projectReportingWithMonths);

        const projectReportingFinal = projectReportingWithMonths.map(p => ({
            ...p,
            kpiItems: kpiItemsMap[p.pro_code] || []
        }));

        // Calculate totals for status display
        const totalProjects = (statusStats.projectStatus) 
            ? (Number(statusStats.projectStatus.notStarted||0) + Number(statusStats.projectStatus.inProgress||0) + Number(statusStats.projectStatus.done||0)) : 0;
        const totalActivities = (statusStats.activityStatus)
            ? (Number(statusStats.activityStatus.notStarted||0) + Number(statusStats.activityStatus.inProgress||0) + Number(statusStats.activityStatus.done||0)) : 0;
        const doneProjects = (statusStats.projectStatus) ? Number(statusStats.projectStatus.done||0) : 0;
        const overallPercent = totalProjects > 0 ? Math.round(doneProjects / totalProjects * 100) : 0;

        res.render('plan', {
            title: 'แดชบอร์ดแผนงาน',
            planStats: {
                totalPlans: basicStats.total_plans || 0,
            },
            projectStats: {
                total: basicStats.total_projects || 0,
                status: statusStats.projectStatus,
            },
            activityStats: {
                total: basicStats.total_activities || 0,
                status: statusStats.activityStatus,
            },
            kpiStats: {
                total: basicStats.total_kpis || 0,
            },
            planOverview,
            projectReporting: projectReportingFinal,
            fiscalMonths,
            selectedFiscalYear,
            fiscalRangeLabel,
            fiscalYearOptions
        });
        
    } catch (error) {
        console.error('PlanController.index error:', error);
        res.status(500).render('error', { 
            message: 'ไม่สามารถโหลดข้อมูลแผนงานได้ กรุณาลองใหม่อีกครั้ง',
            error: process.env.NODE_ENV === 'development' ? error.message : null,
            title: 'เกิดข้อผิดพลาด'
        });
    }
};
