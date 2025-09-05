const Chamra = require('../models/chamraModel');
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
  res.render('chamra/create', { coopList: rows });
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
  res.render('chamra/create', { coopList: rows });
};

// บันทึกเพิ่ม
chamraController.create = async (req, res) => {
  const { active, detail, process } = req.body;
  await Chamra.create({ active, detail, process });
  res.redirect('/chamra');
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

module.exports = chamraController;
