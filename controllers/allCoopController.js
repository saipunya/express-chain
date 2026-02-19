const db = require('../config/db');
const coopProfileModel = require('../models/coopProfileModel');
const addmemModel = require('../models/addmemModel');
const ExcelJS = require('exceljs');

// Render profile by c_code
exports.profile = async (req, res, next) => {
  const { c_code } = req.params;
  try {
    const data = await coopProfileModel.getProfileByCode(c_code);
    if (!data.coop) {
      return res.status(404).render('error_page', { message: 'ไม่พบสหกรณ์รหัสนี้' });
    }

    // ดึงข้อมูล addmem แบบ async/await
    try {
      const addmemData = await addmemModel.getByCoopCode(c_code);
      data.addmem = addmemData || [];
    } catch (err) {
      console.error('Error fetching addmem:', err);
      data.addmem = [];
    }

    const now = new Date();
    const bangkokYear = Number(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' })
        .format(now)
    );
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
    const resolveYearForEndDay = (monthDay, yearNow) => {
      if (!monthDay) return yearNow;
      const month = Number(monthDay.split('-')[0]);
      if (Number.isNaN(month)) return yearNow;
      return month >= 4 ? yearNow - 1 : yearNow;
    };
    const formatThaiDate = (date) => date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
    const endDay = toMonthDay(data.coop.end_day);
    if (endDay) {
      const endYear = resolveYearForEndDay(endDay, bangkokYear);
      const [m, d] = endDay.split('-').map(Number);
      const endDateObj = new Date(Date.UTC(endYear, m - 1, d));
      data.fiscalEndDateThai = formatThaiDate(endDateObj);
    } else {
      data.fiscalEndDateThai = null;
    }

    const [bigmeetRows] = await db.query(
      'SELECT big_date FROM bigmeet WHERE big_code = ? AND big_date IS NOT NULL ORDER BY big_date DESC',
      [c_code]
    );
    if (bigmeetRows && bigmeetRows.length) {
      const firstDate = new Date(bigmeetRows[0].big_date);
      data.bigmeetDateThai = Number.isNaN(firstDate.getTime()) ? null : formatThaiDate(firstDate);
      const grouped = {};
      bigmeetRows.forEach((row) => {
        const d = new Date(row.big_date);
        if (Number.isNaN(d.getTime())) return;
        const yearBe = d.getFullYear() + 543;
        if (!grouped[yearBe]) grouped[yearBe] = [];
        grouped[yearBe].push(formatThaiDate(d));
      });
      data.bigmeetDatesByYear = Object.keys(grouped)
        .sort((a, b) => Number(b) - Number(a))
        .map((year) => ({ year, dates: grouped[year] }));
    } else {
      data.bigmeetDateThai = null;
      data.bigmeetDatesByYear = [];
    }

    res.render('allCoop/profile', { data });
  } catch (e) {
    console.error('profile error', e);
    next(e);
  }
};

// Display all coops (grouped, all results, no pagination)
exports.group = async (req, res) => {
  try {
    console.log('=== allCoop/group route called ===');
    console.log('Query params:', { q: req.query.q, group: req.query.group, params: req.params.group });
    
    const search = req.query.q ? String(req.query.q).trim() : '';
    const currentGroup = req.query.group || req.params.group || '';

    // Table: active_coop with correct column names
    const TABLE_NAME = 'active_coop';
    const COL_CODE = 'c_code';
    const COL_NAME = 'c_name';
    const COL_GROUP = 'c_group';
    const COL_TYPE = 'coop_group';
    const COL_STATUS = 'c_status';

    // Build base query - filter only active coops
    let query = `SELECT * FROM ${TABLE_NAME} WHERE ${COL_STATUS} = 'ดำเนินการ'`;
    const params = [];

    // Filter by group if specified
    if (currentGroup) {
      query += ` AND ${COL_GROUP} = ?`;
      params.push(currentGroup);
    }

    // Search filter (applies to code, name, group)
    if (search) {
      query += ` AND (${COL_CODE} LIKE ? OR ${COL_NAME} LIKE ? OR ${COL_GROUP} LIKE ?)`
      const searchWildcard = '%' + search + '%';
      params.push(searchWildcard, searchWildcard, searchWildcard);
    }

    // Order by code
    query += ` ORDER BY ${COL_CODE} ASC`;

    console.log('Query:', query);
    console.log('Params:', params);

    // Fetch ALL matching records
    const connection = await db.getConnection();
    const [coops] = await connection.query(query, params);
    connection.release();
    
    console.log('Coops fetched:', coops.length);

    // Get unique groups for sidebar (only active coops)
    const connection2 = await db.getConnection();
    const [groupsResult] = await connection2.query(
      `SELECT DISTINCT ${COL_GROUP} FROM ${TABLE_NAME} WHERE ${COL_STATUS} = 'ดำเนินการ' AND ${COL_GROUP} IS NOT NULL AND ${COL_GROUP} != "" ORDER BY ${COL_GROUP}`
    );
    connection2.release();
    
    const groups = groupsResult.map(g => g[COL_GROUP]);
    console.log('Groups fetched:', groups.length);

    res.render('allCoop/group', {
      coops: coops || [],
      groups: groups || [],
      search,
      currentGroup,
      totalResults: (coops || []).length,
      pageTitle: 'สถาบันทั้งหมด'
    });
  } catch (err) {
    console.error('ERROR in allCoop/group:', err.message);
    console.error('Full error:', err);
    res.status(500).render('error_page', { 
      message: 'ไม่สามารถโหลดข้อมูลได้: ' + err.message 
    });
  }
};

// Export active_coop (c_status='ดำเนินการ') to Excel (.xlsx)
exports.exportActiveCoopExcel = async (req, res) => {
  try {
    const search = req.query.q ? String(req.query.q).trim() : '';
    const currentGroup = req.query.group ? String(req.query.group).trim() : '';

    const TABLE_NAME = 'active_coop';
    const COL_CODE = 'c_code';
    const COL_NAME = 'c_name';
    const COL_NO = 'c_no';
    const COL_END_DATE = 'end_date';
    const COL_TYPE = 'coop_group';
    const COL_GROUP = 'c_group';
    const COL_STATUS = 'c_status';

    let query = `
      SELECT ${COL_CODE}, ${COL_NAME}, ${COL_NO}, ${COL_END_DATE}, ${COL_TYPE}
      FROM ${TABLE_NAME}
      WHERE ${COL_STATUS} = 'ดำเนินการ'
    `;
    const params = [];

    if (currentGroup) {
      query += ` AND ${COL_GROUP} = ?`;
      params.push(currentGroup);
    }

    if (search) {
      query += ` AND (${COL_CODE} LIKE ? OR ${COL_NAME} LIKE ? OR ${COL_GROUP} LIKE ?)`;
      const w = `%${search}%`;
      params.push(w, w, w);
    }

    query += ` ORDER BY ${COL_CODE} ASC`;

    const connection = await db.getConnection();
    const [rows] = await connection.query(query, params);
    connection.release();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'express-chain';
    wb.created = new Date();

    const ws = wb.addWorksheet('active_coop');
    ws.columns = [
      { header: 'c_code', key: 'c_code', width: 16 },
      { header: 'c_name', key: 'c_name', width: 50 },
      { header: 'c_no', key: 'c_no', width: 16 },
      { header: 'end_date', key: 'end_date', width: 18 },
      { header: 'coop_group', key: 'coop_group', width: 22 }
    ];

    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    (rows || []).forEach((r) => {
      ws.addRow({
        c_code: r[COL_CODE] ?? '',
        c_name: r[COL_NAME] ?? '',
        c_no: r[COL_NO] ?? '',
        end_date: r[COL_END_DATE] ?? '',
        coop_group: r[COL_TYPE] ?? ''
      });
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `active_coop_${stamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('ERROR exportActiveCoopExcel:', err);
    res.status(500).send('Export failed');
  }
};
