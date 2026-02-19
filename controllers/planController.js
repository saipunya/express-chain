const db = require('../config/db');

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
    if (!value) return '';
    const [yearPart, monthPart] = String(value).split('-');
    const monthIndex = Number(monthPart) - 1;
    const shortName = TH_SHORT_MONTHS[monthIndex] || monthPart;
    const buddhistYear = Number(yearPart) + 543;
    return `${shortName} ${buddhistYear}`;
};

const getCurrentFiscalYear = (referenceDate = new Date()) => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    const buddhistYear = year + 543;
    return month >= 10 ? buddhistYear + 1 : buddhistYear;
};

const buildFiscalRange = (buddhistFiscalYear) => {
    const fy = Number(buddhistFiscalYear);
    if (!Number.isFinite(fy)) {
        return null;
    }
    const startBe = fy - 1;
    const startAd = startBe - 543;
    const endAd = fy - 543;
    return {
        fy,
        startDate: `${startAd}-10-01`,
        endDate: `${endAd}-09-30`,
        startMonth: `${startAd}-10`,
        endMonth: `${endAd}-09`
    };
};

const generateFiscalMonths = (startDate, endDate) => {
    const months = [];
    const pointer = new Date(`${startDate}T00:00:00`);
    const limit = new Date(`${endDate}T00:00:00`);
    while (pointer <= limit) {
        const year = pointer.getFullYear();
        const month = String(pointer.getMonth() + 1).padStart(2, '0');
        const iso = `${year}-${month}`;
        months.push({
            iso,
            label: toThaiMonthLabel(iso),
            shortLabel: toThaiMonthShortLabel(iso)
        });
        pointer.setMonth(pointer.getMonth() + 1);
    }
    return months;
};

exports.index = async function (req, res) {
    try {
        const requestedFy = Number.parseInt(String(req.query.fy ?? ''), 10);
        const currentFy = getCurrentFiscalYear();
        const selectedFiscalYear = Number.isFinite(requestedFy) ? requestedFy : currentFy;
        const fiscalRange = buildFiscalRange(selectedFiscalYear);
        if (!fiscalRange) {
            throw new Error('Invalid fiscal year');
        }
        const { startDate, endDate, startMonth, endMonth } = fiscalRange;
        const fiscalMonths = generateFiscalMonths(startDate, endDate);
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

        // รวมสถิติภาพรวม
        const [[planRow]] = await db.query('SELECT COUNT(*) AS total_plans FROM plan_main');
        const [[projectRow]] = await db.query('SELECT COUNT(*) AS total_projects FROM plan_project');
        const [[activityRow]] = await db.query('SELECT COUNT(*) AS total_activities FROM plan_activity');
        const [[kpiRow]] = await db.query('SELECT COUNT(*) AS total_kpis FROM plan_kpi');

        // นับโครงการตามสถานะ
        const [projectStatusRows] = await db.query(
            'SELECT pro_status, COUNT(*) AS cnt FROM plan_project GROUP BY pro_status'
        );

        const projectStatus = { notStarted: 0, inProgress: 0, done: 0 };
        projectStatusRows.forEach((r) => {
            if (r.pro_status === 2) projectStatus.done = r.cnt;
            else if (r.pro_status === 1) projectStatus.inProgress = r.cnt;
            else projectStatus.notStarted = r.cnt;
        });

        // นับกิจกรรมตามสถานะ
        const [activityStatusRows] = await db.query(
            'SELECT ac_status, COUNT(*) AS cnt FROM plan_activity GROUP BY ac_status'
        );

        const activityStatus = { notStarted: 0, inProgress: 0, done: 0 };
        activityStatusRows.forEach((r) => {
            if (r.ac_status === 2) activityStatus.done = r.cnt;
            else if (r.ac_status === 1) activityStatus.inProgress = r.cnt;
            else activityStatus.notStarted = r.cnt;
        });

        // ภาพรวมต่อแผนหลัก: จำนวนโครงการ และโครงการที่เสร็จแล้ว
        const [planOverview] = await db.query(
            `SELECT m.ma_id, m.ma_code, m.ma_subject,
                            COUNT(DISTINCT p.pro_id) AS project_count,
                            SUM(CASE WHEN p.pro_status = 2 THEN 1 ELSE 0 END) AS done_projects
             FROM plan_main m
             LEFT JOIN plan_project p ON p.pro_macode = m.ma_code
             GROUP BY m.ma_id, m.ma_code, m.ma_subject
             ORDER BY m.ma_code`
        );

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

            const projectReporting = projectReportingRows.map((row) => {
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

        const projectReportingWithMonths = projectReporting.map((project) => {
                let cumulativeSpent = 0;
                const monthlyStatus = fiscalMonths.map((month) => {
                    const operationsReported = operationMonthsMap[project.pro_id]?.has(month.iso) || false;
                    const monthlyAmount = disbursalMap[project.pro_id]?.[month.iso] || 0;
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

        // ── KPI items per project ─────────────────────────────────────────
        const allProCodes = projectReportingWithMonths.map(p => p.pro_code).filter(Boolean);
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

        const projectReportingFinal = projectReportingWithMonths.map(p => ({
            ...p,
            kpiItems: kpiItemsMap[p.pro_code] || []
        }));

        res.render('plan', {
            title: 'แดชบอร์ดแผนงาน',
            planStats: {
                totalPlans: planRow?.total_plans || 0,
            },
            projectStats: {
                total: projectRow?.total_projects || 0,
                status: projectStatus,
            },
            activityStats: {
                total: activityRow?.total_activities || 0,
                status: activityStatus,
            },
            kpiStats: {
                total: kpiRow?.total_kpis || 0,
            },
            planOverview,
            projectReporting: projectReportingFinal,   // ← ใช้ final แทน
            fiscalMonths,
            selectedFiscalYear,
            fiscalRangeLabel,
            fiscalYearOptions
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving plans');
    }
};
