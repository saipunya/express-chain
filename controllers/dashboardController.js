const gitgumModel = require('../models/gitgumModel');
const activityModel = require('../models/activityModel'); // เพิ่มบรรทัดนี้
const { isInstitutionUser } = require('../middlewares/authMiddleware');
const db = require('../config/db');
const coopModel = require('../models/coopModel');
const activeCoopModel = require('../models/activeCoopModel');
const meetingRoomModel = require('../models/meetingRoomModel');
const Project = require('../models/projectModel');
const Command = require('../models/commandModel');
const turnoverModel = require('../models/turnoverModel');
const mergedActivityService = require('../services/mergedActivityService');

function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function mapCalendarEventsToDashboardActivity(calendarEvents) {
  return (calendarEvents || []).map((event) => {
    const props = event.extendedProps || {};
    return {
      date_act: event.start,
      end_act: event.end || null,
      date_label: props.dateLabel || null,
      act_time: props.timeLabel || '',
      activity: event.title,
      place: props.place,
      co_person: props.respon || props.goto,
      detailUrl: props.detailUrl || null
    };
  });
}

async function getMemberSummary() {
  const [[latestYearRow]] = await db.query(`
    SELECT MAX(addmem_year) AS latestYear
    FROM addmem
  `);
  const latestYear = latestYearRow?.latestYear || new Date().getFullYear();

  const [rows] = await db.query(`
    SELECT
      SUM(CASE WHEN ac.coop_group = 'สหกรณ์'
        AND REPLACE(TRIM(COALESCE(ac.in_out_group,'')), CHAR(160), '') = 'ใน'
        THEN COALESCE(a.addmem_saman, 0) ELSE 0 END
      ) AS coop_agri_saman,
      SUM(CASE WHEN ac.coop_group = 'สหกรณ์'
        AND REPLACE(TRIM(COALESCE(ac.in_out_group,'')), CHAR(160), '') = 'ใน'
        THEN COALESCE(a.addmem_somtob, 0) ELSE 0 END
      ) AS coop_agri_somtob,
      SUM(CASE WHEN ac.coop_group = 'สหกรณ์'
        AND REPLACE(TRIM(COALESCE(ac.in_out_group,'')), CHAR(160), '') <> 'ใน'
        THEN COALESCE(a.addmem_saman, 0) ELSE 0 END
      ) AS coop_non_agri_saman,
      SUM(CASE WHEN ac.coop_group = 'สหกรณ์'
        AND REPLACE(TRIM(COALESCE(ac.in_out_group,'')), CHAR(160), '') <> 'ใน'
        THEN COALESCE(a.addmem_somtob, 0) ELSE 0 END
      ) AS coop_non_agri_somtob,
      SUM(CASE WHEN ac.coop_group = 'กลุ่มเกษตรกร'
        THEN COALESCE(a.addmem_saman, 0) ELSE 0 END
      ) AS farmer_group_saman,
      SUM(CASE WHEN ac.coop_group = 'กลุ่มเกษตรกร'
        THEN COALESCE(a.addmem_somtob, 0) ELSE 0 END
      ) AS farmer_group_somtob
    FROM addmem a
    JOIN active_coop ac ON a.addmem_code = ac.c_code
    WHERE ac.c_status = 'ดำเนินการ'
      AND a.addmem_year = ?
  `, [latestYear]);

  const raw = rows?.[0] || {};
  return {
    latestYear,
    memberSummary: {
      coop_agri_saman: Number(raw.coop_agri_saman || 0),
      coop_agri_somtob: Number(raw.coop_agri_somtob || 0),
      coop_non_agri_saman: Number(raw.coop_non_agri_saman || 0),
      coop_non_agri_somtob: Number(raw.coop_non_agri_somtob || 0),
      farmer_group_saman: Number(raw.farmer_group_saman || 0),
      farmer_group_somtob: Number(raw.farmer_group_somtob || 0)
    }
  };
}

async function getDashboardHomeData() {
  const [
    coopStats,
    closingCount,
    closingByGroup,
    coopGroupStats,
    coopTypeSummaryRows,
    meetingsTodayResult,
    lastProjects,
    lastCommands,
    memberData,
    turnoverFiscalSummary
  ] = await Promise.all([
    coopModel.getCoopStats(),
    coopModel.getClosingStats(),
    coopModel.getClosingStatsByGroup(),
    activeCoopModel.getGroupStats(),
    db.query(`
      SELECT
        SUM(CASE WHEN coop_group = 'สหกรณ์' AND inout_bucket = 'agri' THEN 1 ELSE 0 END) AS coop_agri,
        SUM(CASE WHEN coop_group = 'สหกรณ์' AND inout_bucket = 'non_agri' THEN 1 ELSE 0 END) AS coop_non_agri,
        SUM(CASE WHEN coop_group = 'กลุ่มเกษตรกร' THEN 1 ELSE 0 END) AS farmer_group
      FROM (
        SELECT
          coop_group,
          CASE
            WHEN coop_group <> 'สหกรณ์' THEN NULL
            WHEN REPLACE(TRIM(COALESCE(in_out_group,'')), CHAR(160), '') = 'ใน' THEN 'agri'
            ELSE 'non_agri'
          END AS inout_bucket
        FROM active_coop
        WHERE c_status = 'ดำเนินการ'
      ) t
    `),
    meetingRoomModel.getTodayBangkok().catch(() => ({ rows: [], date: null })),
    Project.getLast(5).catch(() => []),
    Command.getLast(5).catch(() => []),
    getMemberSummary().catch(() => ({
      latestYear: new Date().getFullYear(),
      memberSummary: {}
    })),
    turnoverModel.getSummaryByFiscalYear().catch(() => [])
  ]);

  const coopTypeSummary = coopTypeSummaryRows?.[0]?.[0] || {};
  const stats = {
    coop: coopStats.find(item => item.coop_group === 'สหกรณ์')?.count || 0,
    farmer: coopStats.find(item => item.coop_group === 'กลุ่มเกษตรกร')?.count || 0,
    closing: closingCount,
    closingCoop: closingByGroup.coop,
    closingFarmer: closingByGroup.farmer
  };

  return {
    stats,
    coopGroupStats,
    coopTypeSummary: {
      coop_agri: Number(coopTypeSummary.coop_agri || 0),
      coop_non_agri: Number(coopTypeSummary.coop_non_agri || 0),
      farmer_group: Number(coopTypeSummary.farmer_group || 0)
    },
    meetingsToday: meetingsTodayResult.rows || [],
    meetingroomTodayDate: meetingsTodayResult.date || null,
    lastProjects,
    lastCommands,
    turnoverFiscalSummary,
    latestYear: memberData.latestYear,
    memberSummary: memberData.memberSummary
  };
}

exports.index = async (req, res) => {
  const user = req.session.user;
  if (isInstitutionUser(user)) {
    return res.redirect('/dashboard2');
  }

  try {
    const calendarStartDate = mergedActivityService.toYMD(addDays(new Date(), -90));
    const calendarEndDate = mergedActivityService.toYMD(addDays(new Date(), 90));
    const [lastGitgums, activityRows, calendarEvents, homeData] = await Promise.all([
      gitgumModel.getLast(5),
      activityModel.getLastActivities(10),
      mergedActivityService.getMergedCalendarEvents({
        startDate: calendarStartDate,
        endDate: calendarEndDate
      }),
      getDashboardHomeData()
    ]);
    const activity = mapCalendarEventsToDashboardActivity(calendarEvents);

    res.render('dashboard', {
      title: 'แดชบอร์ด',
      user,
      lastGitgums,
      activityRows,
      activity,
      calendarEvents,
      projectCount: homeData.lastProjects.length,
      commandCount: homeData.lastCommands.length,
      memberCount: Object.values(homeData.memberSummary || {}).reduce((sum, value) => sum + Number(value || 0), 0),
      ...homeData
    });
  } catch (error) {
    console.error('[dashboardController] dashboard home data error:', error);
    res.status(500).send('Error fetching dashboard data');
  }
};

exports.institutionIndex = async (req, res) => {
  const user = req.session.user;
  if (!isInstitutionUser(user)) {
    return res.redirect('/dashboard');
  }

  res.render('dashboard2', {
    title: 'แดชบอร์ดสมาชิกสถาบัน',
    user
  });
};

exports.report = (req, res) => {
  // ดึงรายงานจาก DB ได้เลย
  res.send('รายงาน coming soon...');
};
