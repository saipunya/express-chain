const path = require('path');
const fs = require('fs');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const db = require('../config/db');

const allfiles = require('../models/homeModel');
const financeModel = require('../models/financeModel');
const meetingRoomModel = require('../models/meetingRoomModel');
const coopModel = require('../models/coopModel');
const ruleModel = require('../models/ruleModel');
const UseCar = require('../models/usecarModel');
const onlineModel = require('../models/onlineModel');
const rabiabModel = require('../models/rabiabModel');
const businessModel = require('../models/businessModel');
const Project = require('../models/projectModel');
const Rq2 = require('../models/rq2Model');
const Command = require('../models/commandModel');
const activityModel = require('../models/activityModel'); // เพิ่มบรรทัดนี้
const articleModel = require('../models/articleModel'); // เพิ่มบรรทัดนี้
const Chamra = require('../models/chamraModel');
const strengthModel = require('../models/strengthModel'); // NEW strength summary
const coopProfileModel = require('../models/coopProfileModel'); // NEW: for homepage mini list
const gitgumModel = require('../models/gitgumModel'); // NEW: for calendar activities
const bigmeetModel = require('../models/bigmeetModel');

// controllers/homeController.js

const allfiles2 = require('../models/allfilesModel');
const Finance = require('../models/financeModel');

const activeCoopModel = require('../models/activeCoopModel');
const homeController = {
  index: async (req, res) => {
    try {
      const finances = await Finance.getAll();
      const ruleFiles = await ruleModel.getLastUploads();
      const rabiabFiles = await rabiabModel.getLastUploads();
      const businessFiles = await businessModel.getLastUploads(10);
      const allUsecars = await UseCar.getAll() || [];
      const usecars = allUsecars.slice(0, 5);
      const lastProjects = await Project.getLast(10);
      const lastRq2 = await Rq2.getLast(10);
      const lastCommands = await Command.getLast(10);
      const closedCoops = await activeCoopModel.getClosedCoops();
      const meetingDeadlineBase = await activeCoopModel.getMeetingDeadlineBase();

      // ข้อมูลสหกรณ์
      const coopStats = await coopModel.getCoopStats();
      const closingCount = await coopModel.getClosingStats();
      const closingByGroup = await coopModel.getClosingStatsByGroup(); // NEW
      
      // ข้อมูลกราฟ
      const coopGroupChart = await coopModel.getByCoopGroup();
      const cGroupChart = await coopModel.getByGroup();
      const coopGroupStats = await activeCoopModel.getGroupStats();
      
      // ข้อมูลการใช้ออนไลน์
      const onlineUsers = await onlineModel.getOnlineUsers();
      const onlineCount = await onlineModel.getOnlineCount();
      
      const stats = {
        coop: coopStats.find(item => item.coop_group === 'สหกรณ์')?.count || 0,
        farmer: coopStats.find(item => item.coop_group === 'กลุ่มเกษตรกร')?.count || 0,
        closing: closingCount,
        closingCoop: closingByGroup.coop,          // NEW
        closingFarmer: closingByGroup.farmer       // NEW
      };

      // ดึงข้อมูล activity จาก gitgumModel แทน activityModel
      const gitgumsRaw = await gitgumModel.findAll();
      const activity = (gitgumsRaw || []).map(r => ({
        date_act: r.git_date,
        act_time: r.git_time,
        activity: r.git_act,
        place: r.git_place,
        co_person: r.git_respon
      }));
      const lastArticles = await articleModel.getLast(4);
      const homeProcesses = await Chamra.getRecentProcesses(8);
      // NEW: fetch all processes for chart aggregation (use all rows from chamra_process)
      const chamraAllProcesses = await Chamra.getAllProcess();
      // NEW strength grade aggregation
      const latestStrengthYear = await strengthModel.getLatestYear();
      const gradeCounts = latestStrengthYear ? await strengthModel.getGradeCounts(latestStrengthYear).catch(() => []) : [];
      const gradeSet = new Set();
      const strengthData = {};
      gradeCounts.forEach(r => { 
        gradeSet.add(r.st_grade); 
        if (!strengthData[r.coop_group]) strengthData[r.coop_group] = {}; 
        strengthData[r.coop_group][r.st_grade] = r.total; 
      });
      const strengthGrades = Array.from(gradeSet).sort();
      const strengthYear = latestStrengthYear || '-';
      // NEW: fetch small list of coops (mix of coop and farmer) for homepage showcase
      const { rows: homeCoops } = await coopProfileModel.searchCoopsPaged({ page:1, pageSize:6 });

      // Meeting room: today's bookings (Bangkok)
      let meetingsToday = [];
      let meetingroomTodayDate = null;
      try {
        const result = await meetingRoomModel.getTodayBangkok();
        meetingroomTodayDate = result.date;
        meetingsToday = result.rows || [];
      } catch (e) {
        console.error('[homeController] meetingroom error:', e);
      }

      const currentYear = new Date().getFullYear();
      const toMonthDay = (value) => {
        if (!value) return null;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (/^\d{2}-\d{2}$/.test(trimmed)) return trimmed;
          const md = trimmed.slice(5, 10);
          return /^\d{2}-\d{2}$/.test(md) ? md : null;
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${month}-${day}`;
        }
        return null;
      };
      const addDaysUtc = (ymd, days) => {
        const [y, m, d] = ymd.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        date.setUTCDate(date.getUTCDate() + days);
        return date;
      };
      const formatThaiDate = (date) => date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Bangkok'
      });
      const parseDateToUtcMs = (value) => {
        if (!value) return null;
        if (typeof value === 'string') {
          const ymd = value.trim().slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
            const [y, m, d] = ymd.split('-').map(Number);
            return Date.UTC(y, m - 1, d);
          }
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
        }
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
      };
      const bangkokNow = new Date();
      const bangkokYear = Number(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' })
          .format(bangkokNow)
      );
      const bangkokMonth = Number(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', month: '2-digit' })
          .format(bangkokNow)
      );
      const bangkokMonthKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit'
      }).format(bangkokNow);
      const nextBangkokDate = new Date(bangkokNow.getTime());
      nextBangkokDate.setMonth(nextBangkokDate.getMonth() + 1);
      const nextBangkokMonthKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit'
      }).format(nextBangkokDate);
      const meetingDeadlineMonthLabel = bangkokNow.toLocaleDateString('th-TH', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Bangkok'
      });

      const resolveYearForEndDay = (monthDay, yearNow) => {
        if (!monthDay) return yearNow;
        const month = Number(monthDay.split('-')[0]);
        if (Number.isNaN(month)) return yearNow;
        return month >= 4 ? yearNow - 1 : yearNow;
      };

      const meetingDeadlines = (meetingDeadlineBase || [])
        .map((row) => {
          const monthDay = toMonthDay(row.end_day);
          if (!monthDay) return null;
          const endDateYear = resolveYearForEndDay(monthDay, currentYear);
          const endDateYmd = `${endDateYear}-${monthDay}`;
          const endDateObj = addDaysUtc(endDateYmd, 0);
          const deadlineObj = addDaysUtc(endDateYmd, 150);
          const deadlineMonthKey = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit'
          }).format(deadlineObj);
          return {
            c_code: row.c_code,
            c_name: row.c_name,
            c_group: row.c_group,
            coop_group: row.coop_group,
            endDateYmd,
            endDateThai: formatThaiDate(endDateObj),
            deadlineYmd: deadlineObj.toISOString().slice(0, 10),
            deadlineThai: formatThaiDate(deadlineObj),
            deadlineSort: deadlineObj.getTime(),
            deadlineMonthKey,
            endDateMs: endDateObj.getTime(),
            deadlineMs: deadlineObj.getTime()
          };
        })
        .filter(Boolean)
        .filter((row) => row.deadlineMonthKey === bangkokMonthKey || row.deadlineMonthKey === nextBangkokMonthKey)
        .sort((a, b) => a.deadlineSort - b.deadlineSort);

      const meetingCodes = meetingDeadlines.map((row) => row.c_code).filter(Boolean);
      const bigmeetRows = await bigmeetModel.findByCodes(meetingCodes);
      const bigmeetMap = bigmeetRows.reduce((acc, row) => {
        const key = row.big_code || '';
        const ms = parseDateToUtcMs(row.big_date);
        if (!key || ms === null) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push({ ms, raw: row.big_date });
        return acc;
      }, {});

      const meetingDeadlinesWithStatus = meetingDeadlines.map((row) => {
        const dates = bigmeetMap[row.c_code] || [];
        const inWindow = dates
          .filter((item) => item.ms >= row.endDateMs && item.ms <= row.deadlineMs)
          .sort((a, b) => a.ms - b.ms);
        const meetingDateThai = inWindow.length
          ? formatThaiDate(new Date(inWindow[0].ms))
          : null;
        return { ...row, meetingDateThai };
      });

      const meetingDeadlinesGrouped = meetingDeadlinesWithStatus.reduce((acc, row) => {
        const groupKey = row.c_group || 'ไม่ระบุกลุ่ม';
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(row);
        return acc;
      }, {});

      const meetingDeadlineGroups = Object.keys(meetingDeadlinesGrouped)
        .sort((a, b) => a.localeCompare(b, 'th-TH'))
        .map((groupName) => {
          const rows = meetingDeadlinesGrouped[groupName].slice().sort((a, b) =>
            (a.c_name || '').localeCompare(b.c_name || '', 'th-TH')
          );
          return { groupName, rows };
        });

      res.render('home', { 
        finances, 
        ruleFiles,
        rabiabFiles,
        businessFiles,
        usecars,
        lastProjects,
        lastRq2,
        lastCommands,
        stats,
        onlineUsers,
        onlineCount,
        coopGroupChart, // ✅ ส่งไปที่ view
        cGroupChart,    // ✅ ส่งไปที่ view
        activity,
        lastArticles,    // ✅ ส่งไปที่ view
        closedCoops,     // ✅ ส่ง closed coops to view
        coopGroupStats,   // ✅ ส่งข้อมูลสถิติกลุ่มสหกรณ์ไปที่ view
        homeProcesses,
        chamraAllProcesses, // NEW: all rows for chart
        closingByGroup,   // NEW expose raw
        strengthGrades,   // NEW list of grade labels
        strengthData,     // NEW mapping { coop_group: { grade: count } }
        strengthYear,     // NEW selected year for display
        homeCoops,        // NEW variable for view
        meetingsToday,
        meetingroomTodayDate,
        meetingDeadlineGroups,
        meetingDeadlineMonthLabel,
        title: 'ระบบสารสนเทศและเครือข่ายสหกรณ์ในจังหวัดภูมิ'
      });
      //console.log('coopGroupStats', coopGroupStats); // ดูข้อมูลที่ได้
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).send('Error fetching data');
    }
  },
};

exports.downloadById = async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await allfiles.getFileById(fileId);
    if (!file) {
      return res.status(404).send('ไม่พบไฟล์');
    }

    const filename = path.basename(file.file_name);
    const filePath = path.join(__dirname, '..', 'uploads', 'finance', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไม่พบไฟล์ในระบบ');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes;

    if (isAdmin) {
      // 🔹 Admin: ไม่ลายน้ำ
      finalPdfBytes = pdfBytes;
    } else {
      // 🔸 ้ใช้ วไป: เ่่มลายน้ำ
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      const watermarkText = 'ใช้สหกรณ์เท่านั้น !';

      pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 4,
          y: height / 2,
          size: 30,
          font: customFont,
          color: rgb(1, 0, 0),
          opacity: 0.3,
          rotate: degrees(45)
        });
      });

      finalPdfBytes = await pdfDoc.save();
    }

    // ✅ แสดง PDF ใน browser (inline)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(finalPdfBytes));
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('ข้อพลาดในการแสดงไฟล์');
  }
};

exports.home = async (req, res) => {
  try {
    const activity = await getActivity(); // ดึงข้อมูล activity จาก model หรือ service
    res.render('home', {
      activity, // เพิ่มบรรทัดนี้
    });
  } catch (err) {
    console.error('Error fetching home data:', err);
    res.status(500).send('Server Error');
  }
};

exports.loadFinance = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const totalFiles = await financeModel.countFinanceFiles(search);
    const totalPages = Math.ceil(totalFiles / financeModel.ITEMS_PER_PAGE);

    const fileAll = await financeModel.getFinanceFiles(search, page);

    res.render('loadFinance', {
      title: 'ไฟล์QtCore',
      fileAll,
      currentPage: page,
      totalPages,
      search
    });
  } catch (err) {
    console.error('Error loading finance files:', err);
    res.status(500).send('ข้อพลาดในการโหลดข้อมูล');
  }
};

exports.showDashboard = async (req, res) => {
  try {
    const [statusStats] = await db.query(`
      SELECT coop_group, c_status, COUNT(*) AS total
      FROM active_coop
      GROUP BY coop_group, c_status
    `);

    const [groupStats] = await db.query(`
      SELECT c_group, COUNT(*) AS total
      FROM active_coop
      GROUP BY c_group
    `);

    const [typeStats] = await db.query(`
      SELECT coop_group, c_type, COUNT(*) AS total
      FROM active_coop
      GROUP BY coop_group, c_type
    `);

    res.render('home', {
      statusStats,
      groupStats,
      typeStats
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).send('Server Error');
  }
};


module.exports = homeController;
