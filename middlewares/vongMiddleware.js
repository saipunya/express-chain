const multer = require('multer');
const path = require('path');

// กำหนด storage ของ multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/vong'); // โฟลเดอร์เก็บไฟล์
  },
  filename: function (req, file, cb) {
    // ตั้งชื่อไฟล์ใหม่ เช่น c_code + ปี + timestamp + นามสกุลไฟล์
    // สมมติ req.body.vong_code กับ req.body.vong_year มีข้อมูล

    const ext = path.extname(file.originalname); // นามสกุลไฟล์ .pdf, .docx, etc.
    const vong_code = req.body.vong_code || 'file';  // fallback กรณีไม่มีข้อมูล
    const vong_year = req.body.vong_year || new Date().getFullYear();

    const uniqueSuffix = Date.now(); // หรือใช้ Math.random() เพิ่มเติมก็ได้
    const filename = `${vong_code}_${vong_year}_${uniqueSuffix}${ext}`;

    cb(null, filename);
  }
});

const upload = multer({ storage });

module.exports = upload;