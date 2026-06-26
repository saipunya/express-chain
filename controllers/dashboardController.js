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

function toBangkokDateKey(value) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
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

async function getVehicleUsageSummary() {
  const [rows] = await db.query(`
    SELECT
      vr.id,
      vr.vehicle_request_no,
      vr.destination_text,
      vr.requester_name,
      vr.passenger_count,
      vr.trip_start_at,
      vr.trip_end_at,
      vr.status,
      COALESCE(va.plate_no_snapshot, vm.plate_no, '-') AS plate_no,
      COALESCE(va.driver_name_snapshot, dm.driver_name, '-') AS driver_name
    FROM vehicle_requests vr
    INNER JOIN vehicle_assignments va ON va.vehicle_request_id = vr.id
    LEFT JOIN vehicle_masters vm ON vm.id = va.vehicle_id
    LEFT JOIN driver_masters dm ON dm.id = va.driver_id
    WHERE vr.status NOT IN ('cancelled', 'rejected', 'draft')
    ORDER BY vr.trip_start_at DESC, vr.id DESC
  `);

  const byPlateMap = new Map();
  const byDateMap = new Map();

  (rows || []).forEach((row) => {
    const plateNo = row.plate_no || '-';
    const startKey = toBangkokDateKey(row.trip_start_at);
    const endKey = toBangkokDateKey(row.trip_end_at || row.trip_start_at);
    const item = {
      id: row.id,
      vehicleRequestNo: row.vehicle_request_no,
      plateNo,
      driverName: row.driver_name || '-',
      destination: row.destination_text || '-',
      requesterName: row.requester_name || '-',
      passengerCount: Number(row.passenger_count || 0),
      tripStartAt: row.trip_start_at,
      tripEndAt: row.trip_end_at,
      startDateKey: startKey,
      endDateKey: endKey,
      status: row.status
    };

    if (!byPlateMap.has(plateNo)) {
      byPlateMap.set(plateNo, {
        plateNo,
        total: 0,
        drivers: new Set(),
        lastUsageAt: null
      });
    }
    const plateSummary = byPlateMap.get(plateNo);
    plateSummary.total += 1;
    if (item.driverName && item.driverName !== '-') {
      plateSummary.drivers.add(item.driverName);
    }
    if (!plateSummary.lastUsageAt || new Date(item.tripStartAt) > new Date(plateSummary.lastUsageAt)) {
      plateSummary.lastUsageAt = item.tripStartAt;
    }

    const dateKey = startKey || 'ไม่ระบุวันที่';
    if (!byDateMap.has(dateKey)) {
      byDateMap.set(dateKey, {
        dateKey,
        total: 0,
        plates: new Set(),
        items: []
      });
    }
    const dateSummary = byDateMap.get(dateKey);
    dateSummary.total += 1;
    dateSummary.plates.add(plateNo);
    dateSummary.items.push(item);
  });

  return {
    total: rows.length,
    byPlate: Array.from(byPlateMap.values())
      .map((item) => ({
        ...item,
        drivers: Array.from(item.drivers).slice(0, 3)
      }))
      .sort((left, right) => right.total - left.total || String(left.plateNo).localeCompare(String(right.plateNo), 'th')),
    byDate: Array.from(byDateMap.values())
      .map((item) => ({
        ...item,
        plates: Array.from(item.plates),
        items: item.items.slice(0, 4)
      }))
      .sort((left, right) => String(right.dateKey).localeCompare(String(left.dateKey)))
      .slice(0, 8)
  };
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
    turnoverFiscalSummary,
    vehicleUsageSummary
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
    turnoverModel.getSummaryByFiscalYear().catch(() => []),
    getVehicleUsageSummary().catch((error) => {
      console.error('[dashboardController] vehicle usage summary error:', error);
      return { total: 0, byPlate: [], byDate: [] };
    })
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
    vehicleUsageSummary,
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
