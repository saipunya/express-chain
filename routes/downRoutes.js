const express = require('express');
const router = express.Router();
const downController = require('../controllers/downController'); // ✅ เปลี่ยนชื่อ controller
const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/down/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '_' + file.originalname);
  }
});
const upload = multer({ storage });

router.get('/', downController.list);
router.get('/view/:id', downController.view);
router.get('/create', downController.createForm);
router.post('/create', upload.single('down_file'), downController.create); // ✅ รองรับ upload
router.get('/edit/:id', downController.editForm);
router.post('/edit/:id', upload.single('down_file'), downController.update); // ✅ รองรับ upload
router.post('/delete/:id', downController.delete);
router.get('/download/:id', downController.download);

router.get('/search', async (req, res) => {
  const keyword = req.query.keyword || '';
  const results = await require('../models/downModel').searchBySubject(keyword);
  res.json(results);
});

module.exports = router;