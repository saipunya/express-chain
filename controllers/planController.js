const db = require('../config/db');

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
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving plans');
    }
};
