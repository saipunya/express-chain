const Chamra = require('../models/chamraModel'); // unified model
const db = require('../config/db');

const chamraController = {};

// แสดงทั้งหมด
chamraController.list = async (req, res) => {
  const data = await Chamra.getAll();
  res.render('chamra/list', { data });
};

chamraController.listPob = async (req, res) => {
  const poblems = await Chamra.getAllPob();
  res.render('chamra/poblem/list', { poblems });
};

// แสดง form เพิ่ม
chamraController.addForm = async (req, res) => {
  const [rows] = await db.query(
    "SELECT c_code, c_name FROM active_coop WHERE c_status = 'เลิก'"
  );
  res.render('chamra/create', { coopList: rows, user: req.user || null });
};

// แสดง form แก้ไข
chamraController.editForm = async (req, res) => {
  const code = req.params.c_code;
  try {
    // ดึงข้อมูลจากฐานข้อมูลตาม code
    const record = await Chamra.getByCode(code); // สมมติว่าใน chamraModel มีฟังก์ชัน getByCode
    if (!record) {
      return res.status(404).send("ไม่พบข้อมูลสำหรับรหัสนี้");
    }
    res.render('chamra/edit', { chamra: record });
  } catch (error) {
    console.error(error);
    res.status(500).send("เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์");
  }
};

// แสดง form สร้าง
chamraController.createForm = async (req, res) => {
  const [rows] = await db.query(
    "SELECT c_code, c_name FROM active_coop WHERE c_status = 'เลิก'"
  );
  res.render('chamra/create', { coopList: rows, user: req.user || null });
};

// บันทึกเพิ่ม
chamraController.create = async (req, res, next) => {
  try {
    const {
      de_code,
      de_case,
      de_comno,
      de_comdate,
      de_person,
      de_maihed,
      de_saveby,
      de_savedate
    } = req.body;

    if (!de_code || !de_case) {
      return res.status(400).send('de_code and de_case are required');
    }

    const normalizedDate = (de_savedate && /^\d{4}-\d{2}-\d{2}$/.test(de_savedate)) ? de_savedate : new Date();

    await Chamra.create({
      de_code,
      de_case,
      de_comno,
      de_comdate,
      de_person,
      de_maihed,
      de_saveby: de_saveby || (req.user && (req.user.fullname || req.user.username)) || 'system',
      de_savedate: normalizedDate
    });

    return res.redirect('/chamra');
  } catch (err) {
    console.error('Create Chamra failed:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).send('Table chamra_detail not found. Please create it.');
    }
    return res.status(500).send('Internal Server Error');
  }
};

// บันทึกแก้ไข
chamraController.update = async (req, res) => {
  const c_code = req.params.c_code;
  const { active, detail, process } = req.body;
  await Chamra.update(c_code, { active, detail, process });
  res.redirect('/chamra');
};

// ลบ
chamraController.delete = async (req, res) => {
  const c_code = req.params.c_code;
  await Chamra.delete(c_code);
  res.redirect('/chamra');
};

// แสดงฟอร์มเพิ่มปัญหา
chamraController.createFormPob = async (req, res) => {
  // ดึงปีและครั้งประชุมจาก query (หรือกำหนดค่าตามต้องการ)
  const { po_year, po_meeting } = req.query;

  // ดึงรายชื่อสถาบันทั้งหมด
  const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop WHERE c_status = "เลิก"');

  let filteredCoopList = coopList;

  // ถ้ามี po_year และ po_meeting ให้กรองชื่อที่ซ้ำออก
  if (po_year && po_meeting) {
    const [used] = await db.query(
      'SELECT po_code FROM chamra_poblem WHERE po_year = ? AND po_meeting = ?',
      [po_year, po_meeting]
    );
    const usedCodes = used.map(u => u.po_code);
    filteredCoopList = coopList.filter(coop => !usedCodes.includes(coop.c_code));
  }

  res.render('chamra/poblem/create', { coopList: filteredCoopList, exist: false, po_year, po_meeting });
};

// บันทึกข้อมูลปัญหาใหม่
chamraController.createPob = async (req, res) => {
  const {
    po_code,
    po_year,
    po_meeting,
    po_detail,
    po_problem,
    po_saveby,
    po_savedate
  } = req.body;

  // เช็คซ้ำ
  const [rows] = await db.query(
    'SELECT COUNT(*) as total FROM chamra_poblem WHERE po_code = ? AND po_year = ? AND po_meeting = ?',
    [po_code, po_year, po_meeting]
  );
  if (rows[0].total > 0) {
    // ส่งกลับฟอร์มพร้อมแจ้งเตือน
    const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop');
    return res.render('chamra/poblem/create', {
      coopList,
      exist: true,
      po_year,
      po_meeting,
      message: 'มีข้อมูลปีและครั้งประชุมนี้แล้ว'
    });
  }

  // ถ้าไม่ซ้ำ ให้บันทึก
  try {
    await db.query(
      `INSERT INTO chamra_poblem 
        (po_code, po_year, po_meeting, po_detail, po_problem, po_saveby, po_savedate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,

      [po_code, po_year, po_meeting, po_detail, po_problem, po_saveby, po_savedate]
    );
    res.redirect('/chamra/poblem');
  } catch (err) {
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
};

chamraController.checkPoblemExist = async (req, res) => {
  const { po_code, po_year, po_meeting } = req.query;
  if (!po_code || !po_year || !po_meeting) return res.json({ exist: false });
  const [rows] = await db.query(
    'SELECT COUNT(*) as total FROM chamra_poblem WHERE po_code = ? AND po_year = ? AND po_meeting = ?',
    [po_code, po_year, po_meeting]
  );
  res.json({ exist: rows[0].total > 0 });
};

chamraController.getAvailableCoop = async (req, res) => {
  const { po_year, po_meeting } = req.query;
  if (!po_year || !po_meeting) return res.json([]);
  const [used] = await db.query(
    'SELECT po_code FROM chamra_poblem WHERE po_year = ? AND po_meeting = ?',
    [po_year, po_meeting]
  );
  const usedCodes = used.map(u => u.po_code);
  let sql = 'SELECT c_code, c_name FROM active_coop WHERE c_status = "เลิก"';
  if (usedCodes.length > 0) {
    sql += ` AND c_code NOT IN (${usedCodes.map(() => '?').join(',')})`;
  }
  const [coopList] = await db.query(sql, usedCodes);
  res.json(coopList);
};

chamraController.deletePoblem = async (req, res) => {
  const { po_id } = req.params;
  try {
    await db.query('DELETE FROM chamra_poblem WHERE po_id = ?', [po_id]);
    res.redirect('/chamra/poblem'); // Redirect to the problem list page after deletion
  } catch (error) {
    console.error('Error deleting Chamra Poblem:', error);
    res.status(500).send('Internal Server Error');
  }
};

// แสดงรายละเอียดรวมทุกตาราง
chamraController.detail = async (req, res) => {
  const code = req.params.c_code;
  try {
    const record = await Chamra.getByCode(code); // detail + process + coop
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    const poblems = await Chamra.getPoblemsByCode(code);
    res.render('chamra/detail', {
      data: record,
      poblems
    });
  } catch (e) {
    console.error('detail error:', e);
    res.status(500).send('Internal Server Error');
  }
};

// แสดงรายการกระบวนการ
chamraController.processList = async (req, res) => {
  const processes = await Chamra.getAllProcess();
  res.render('chamra/process/list', { processes });
};

// แสดงฟอร์มแก้ไข (ถ้าต้องการหน้าแยก; ที่นี่ใช้ในหน้า list ก็ได้)
chamraController.processEdit = async (req, res) => {
  const pr = await Chamra.getProcessById(req.params.pr_id);
  if (!pr) return res.status(404).send('ไม่พบรายการ');
  res.render('chamra/process/edit', { process: pr }); // สร้างไฟล์นี้หากต้องการใช้หน้าแยก
};

// อัปเดต (inline submit)
chamraController.processUpdate = async (req, res) => {
  await Chamra.updateProcess(req.params.pr_id, req.body);
  res.redirect('/chamra/process');
};

// ลบ
chamraController.processDelete = async (req, res) => {
  await Chamra.deleteProcess(req.params.pr_id);
  res.redirect('/chamra/process');
};

// ฟอร์มเพิ่มกระบวนการ
chamraController.processCreateForm = async (req, res) => {
  const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name');
  res.render('chamra/process/create', { coopList, error: null, old: {} });
};

// บันทึกเพิ่มกระบวนการ
chamraController.processCreate = async (req, res) => {
  const {
    pr_code,
    pr_s1, pr_s2, pr_s3, pr_s4, pr_s5,
    pr_s6, pr_s7, pr_s8, pr_s9, pr_s10
  } = req.body;
  if (!pr_code) {
    const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name');
    return res.render('chamra/process/create', { coopList, error: 'กรุณาเลือกรหัสสถาบัน', old: req.body });
  }
  try {
    await Chamra.createProcess({
      pr_code,
      pr_s1, pr_s2, pr_s3, pr_s4, pr_s5,
      pr_s6, pr_s7, pr_s8, pr_s9, pr_s10
    });
    return res.redirect('/chamra/process');
  } catch (e) {
    const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name');
    if (e.code === 'DUPLICATE_CODE') {
      return res.render('chamra/process/create', { coopList, error: 'มีรหัสนี้อยู่แล้ว', old: req.body });
    }
    console.error(e);
    return res.render('chamra/process/create', { coopList, error: 'เกิดข้อผิดพลาด', old: req.body });
  }
};

module.exports = chamraController;
