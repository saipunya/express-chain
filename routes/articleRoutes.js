const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const multer = require('../middleware/secureUpload');
const fs = require('fs');
const path = require('path');

// Multer config: uploads/activity/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join('uploads/article');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
});
const upload = multer({ storage, fileFilter: multer.fileFilter(['.jpg', '.jpeg', '.png', '.gif', '.webp']) });

router.get('/', articleController.list);
router.get('/view/:id', articleController.view);
router.get('/create', articleController.createForm);
router.post('/create', upload.array('ar_img', 10), articleController.create);
router.get('/edit/:id', articleController.editForm);
router.post('/edit/:id', upload.array('ar_img', 10), articleController.update);
router.post('/delete/:id', articleController.delete);

module.exports = router;