const db = require('../config/db');
const coopProfileModel = require('../models/coopProfileModel');
const addmemModel = require('../models/addmemModel');

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
