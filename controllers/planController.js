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

exports.index = async function (req, res) {
    try {
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
                COALESCE(act.total_activities, 0) AS total_activities,
                COALESCE(act.reported_activities, 0) AS reported_activities,
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
                    COUNT(DISTINCT IF(am.status IS NOT NULL, a.ac_id, NULL)) AS reported_activities,
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
                achievementPercent,
                latestKpiLabel: toThaiMonthLabel(row.latest_report_month),
                latestActivityLabel: toThaiMonthLabel(row.latest_activity_month)
            };
        });

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
            projectReporting
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving plans');
    }
};
