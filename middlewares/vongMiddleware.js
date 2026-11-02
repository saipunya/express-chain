const multer = require('../middleware/secureUpload');

// กำหนด storage ของ multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/vong'); // โฟลเดอร์เก็บไฟล์
  },
});

const upload = multer({ storage, fileFilter: multer.fileFilter(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.zip', '.rar']) });

module.exports = upload;