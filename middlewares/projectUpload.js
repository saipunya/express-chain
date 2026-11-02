const multer = require('../middleware/secureUpload');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/project');
  },
});

const upload = multer({ storage, fileFilter: multer.fileFilter(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.zip', '.rar']) });

module.exports = upload;

