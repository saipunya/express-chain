const addmemModel = require('../models/addmemModel');
const db = require('../config/db');

// แสดงรายการ (รองรับ pagination)
exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || '';
    const success = req.query.success || '';
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    if (search) {
      whereClause = `WHERE ac.c_name LIKE '%${search}%'`;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM addmem a
      JOIN active_coop ac ON a.addmem_code = ac.c_code
      ${whereClause}
    `;

    const query = `
      SELECT 
        a.addmem_id,
        a.addmem_code,
        a.addmem_year,
        a.addmem_saman,
        a.addmem_somtob,
        a.addmem_saveby,
        a.addmem_savedate,
        ac.c_name
      FROM addmem a
      JOIN active_coop ac ON a.addmem_code = ac.c_code
      ${whereClause}
      ORDER BY a.addmem_savedate DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult] = await db.query(countQuery);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / pageSize);

    const [results] = await db.query(query, [pageSize, offset]);

    res.render('addmem_list', {
      data: results,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      },
      search,
      success,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error in addmem list:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

// แสดงฟอร์มเพิ่มข้อมูล
exports.addForm = async (req, res) => {
  try {
    // ดึงข้อมูลสหกรณ์/กลุ่มเกษตรกรทั้งหมด พร้อมกลุ่ม (c_group)
    const [coops] = await db.query(
      'SELECT c_code, c_name, c_group FROM active_coop ORDER BY c_group, c_name'
    );
    
    // ดึงกลุ่มที่มีอยู่จริง (DISTINCT)
    const [groups] = await db.query(
      'SELECT DISTINCT c_group FROM active_coop WHERE c_group IS NOT NULL AND c_group != "" ORDER BY c_group'
    );
    
    // ดึงข้อมูลล่าสุด 10 รายการ
    const [recentData] = await db.query(`
      SELECT am.*, ac.c_name, ac.end_date
      FROM addmem am 
      LEFT JOIN active_coop ac ON am.addmem_code = ac.c_code 
      ORDER BY am.addmem_savedate DESC 
      LIMIT 10
    `);
    
    res.render('addmem_form', {
      action: 'add',
      record: {},
      coops: coops || [],
      groups: groups || [],
      recentData: recentData || [],
      user: req.session.user || req.user || null
    });
  } catch (error) {
    console.error('Error in addForm:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์ม');
  }
};

// แสดงฟอร์มแก้ไข
exports.editForm = async (req, res) => {
  try {
    const { addmem_id } = req.params;
    
    // ดึงข้อมูลสหกรณ์/กลุ่มเกษตรกรทั้งหมด พร้อมกลุ่ม (c_group)
    const [coops] = await db.query(
      'SELECT c_code, c_name, c_group FROM active_coop ORDER BY c_group, c_name'
    );
    
    // ดึงกลุ่มที่มีอยู่จริง (DISTINCT)
    const [groups] = await db.query(
      'SELECT DISTINCT c_group FROM active_coop WHERE c_group IS NOT NULL AND c_group != "" ORDER BY c_group'
    );
    
    // ดึงข้อมูลที่ต้องการแก้ไข
    const [records] = await db.query(
      'SELECT * FROM addmem WHERE addmem_id = ?',
      [addmem_id]
    );
    
    if (!records || records.length === 0) {
      return res.status(404).send('ไม่พบข้อมูล');
    }
    
    // ดึงข้อมูลล่าสุด 10 รายการ
    const [recentData] = await db.query(`
      SELECT am.*, ac.c_name, ac.end_date
      FROM addmem am 
      LEFT JOIN active_coop ac ON am.addmem_code = ac.c_code 
      ORDER BY am.addmem_savedate DESC 
      LIMIT 10
    `);
    
    res.render('addmem_form', {
      action: 'edit',
      record: records[0],
      coops: coops || [],
      groups: groups || [],
      recentData: recentData || [],
      user: req.session.user || req.user || null
    });
  } catch (error) {
    console.error('Error in editForm:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์ม');
  }
};

// GET: Show form for adding new or editing existing member
exports.form = async (req, res) => {
  try {
    const { id } = req.params;
    let record = {};
    let action = 'add';

    // Fetch all active cooperatives for dropdown with groups
    const [coops] = await db.query(
      'SELECT c_code, c_name, c_group FROM active_coop ORDER BY c_group, c_name'
    );

    // Fetch distinct groups
    const [groups] = await db.query(
      'SELECT DISTINCT c_group FROM active_coop WHERE c_group IS NOT NULL AND c_group != "" ORDER BY c_group'
    );

    // If editing, fetch the record
    if (id) {
      const [rows] = await db.query(
        'SELECT * FROM addmem WHERE addmem_id = ?',
        [id]
      );
      if (rows.length > 0) {
        record = rows[0];
        action = 'edit';
      }
    }

    // Fetch recent data
    const [recentData] = await db.query(`
      SELECT am.*, ac.c_name, ac.end_date FROM addmem am
      LEFT JOIN active_coop ac ON am.addmem_code = ac.c_code
      ORDER BY am.addmem_savedate DESC LIMIT 10
    `);

    res.render('addmem_form', {
      action,
      record,
      coops: coops || [],
      groups: groups || [],
      recentData: recentData || [],
      user: req.session.user || req.user || null,
      pageTitle: action === 'edit' ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'
    });
  } catch (err) {
    console.error('Error in form:', err);
    res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาด: ' + err.message });
  }
};

// POST: Save new member
exports.save = async (req, res) => {
  try {
    const { addmem_code, addmem_year, addmem_saman, addmem_somtob, addmem_saveby, addmem_savedate } = req.body;

    if (!addmem_code) {
      return res.status(400).send('กรุณาเลือกสหกรณ์');
    }

    await db.query(
      `INSERT INTO addmem (addmem_code, addmem_year, addmem_saman, addmem_somtob, addmem_saveby, addmem_savedate)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [addmem_code, addmem_year, addmem_saman, addmem_somtob, addmem_saveby || 'system', addmem_savedate || new Date().toISOString().slice(0, 10)]
    );

    res.redirect('/addmem/list?success=เพิ่มข้อมูลสมาชิกเพิ่มเติมสำเร็จ');
  } catch (err) {
    console.error('Error in save:', err);
    res.status(500).send('เกิดข้อผิดพลาด: ' + err.message);
  }
};

// POST: Update existing member
exports.update = async (req, res) => {
  try {
    const { addmem_id } = req.params;
    const { addmem_code, addmem_year, addmem_saman, addmem_somtob } = req.body;

    if (!addmem_code) {
      return res.status(400).send('กรุณาเลือกสหกรณ์');
    }

    await db.query(
      `UPDATE addmem SET addmem_code = ?, addmem_year = ?, addmem_saman = ?, addmem_somtob = ?
       WHERE addmem_id = ?`,
      [addmem_code, addmem_year, addmem_saman, addmem_somtob, addmem_id]
    );

    res.redirect('/addmem/list?success=แก้ไขข้อมูลสมาชิกเพิ่มเติมสำเร็จ');
  } catch (err) {
    console.error('Error in update:', err);
    res.status(500).send('เกิดข้อผิดพลาด: ' + err.message);
  }
};

// แสดงรายละเอียด
exports.viewOne = async (req, res) => {
  try {
    const query = `
      SELECT a.*, ac.c_name
      FROM addmem a
      LEFT JOIN active_coop ac ON a.addmem_code = ac.c_code
      WHERE a.addmem_id = ?
    `;
    const [rows] = await db.query(query, [req.params.id]);
    
    if (!rows || rows.length === 0) return res.status(404).send('ไม่พบข้อมูล');
    
    res.render('addmem_view', { 
      title: 'รายละเอียดสมาชิกเพิ่มเติม', 
      record: rows[0]
    });
  } catch (error) {
    console.error('Error viewing addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

// แสดงฟอร์มแก้ไข
exports.showEditForm = async (req, res) => {
  try {
    const record = await addmemModel.findById(req.params.id);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    
    // ดึงข้อมูลล่าสุดมาแสดง
    const recentData = await addmemModel.findRecent(5);
    
    res.render('addmem_form', { 
      title: 'แก้ไขสมาชิกเพิ่มเติม', 
      record,
      recentData,
      action: 'edit'
    });
  } catch (error) {
    console.error('Error in edit form:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์มแก้ไข');
  }
};

// อัปเดต
exports.updateAddmem = async (req, res) => {
  try {
    const { addmem_code, addmem_year, addmem_saman, addmem_somtob } = req.body;
    const id = req.params.id;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!addmem_code || !addmem_year || !addmem_saman || !addmem_somtob) {
      return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
    
    // ตรวจสอบว่ารหัสซ้ำหรือไม่ (ยกเว้นรายการปัจจุบัน)
    const isDuplicate = await addmemModel.isCodeDuplicate(addmem_code, id);
    if (isDuplicate) {
      return res.status(400).send('รหัสสมาชิกนี้มีอยู่แล้ว');
    }
    
    // เตรียมข้อมูลสำหรับอัปเดต
    const data = {
      addmem_code,
      addmem_year,
      addmem_saman: parseInt(addmem_saman),
      addmem_somtob: parseInt(addmem_somtob),
      addmem_saveby: (req.user && req.user.fullname) ? req.user.fullname : 'guest',
      addmem_savedate: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    await addmemModel.update(id, data);
    res.redirect('/addmem/list');
    
  } catch (error) {
    console.error('Error updating addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
  }
};

// ลบ
exports.deleteAddmem = async (req, res) => {
  try {
    const id = req.params.id;
    
    // ตรวจสอบว่ามีข้อมูลอยู่จริง
    const record = await addmemModel.findById(id);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    
    await addmemModel.delete(id);
    res.redirect('/addmem/list?success=ลบข้อมูลสมาชิกเพิ่มเติมสำเร็จ');
    
  } catch (error) {
    console.error('Error deleting addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการลบข้อมูล');
  }
};

// API สำหรับค้นหาตามรหัส (สำหรับ AJAX)
exports.searchByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.json([]);
    }
    
    const record = await addmemModel.findByCode(code);
    res.json(record ? [record] : []);
    
  } catch (error) {
    console.error('Error searching addmem:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหา' });
  }
};
