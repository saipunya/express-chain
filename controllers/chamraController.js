const Chamra = require('../models/chamraModel');
const db = require('../config/db');

const chamraController = {};

// แสดงทั้งหมด
chamraController.list = async (req, res) => {
  const data = await Chamra.getAll();
  res.render('chamra/list', { data });
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

module.exports = chamraController;
