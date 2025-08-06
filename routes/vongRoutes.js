const express = require('express');
const router = express.Router();
const controller = require('../controllers/vongController');
const upload = require('../middlewares/vongMiddleware');

// แสดงรายการ
router.get('/', controller.index);

// ฟอร์มเพิ่มข้อมูล
router.get('/create', controller.showForm);

// เพิ่มข้อมูล (upload ไฟล์ชื่อฟิลด์ 'vong_file')
router.post('/create', upload.single('vong_file'), controller.create);

// ฟอร์มแก้ไข
router.get('/edit/:id', controller.editForm);

// แก้ไขข้อมูล (upload ไฟล์ชื่อฟิลด์ 'vong_file')
router.post('/edit/:id', upload.single('vong_file'), controller.update);

// ลบข้อมูล
router.get('/delete/:id', controller.delete);

// ดาวน์โหลดไฟล์
router.get('/download/:id', controller.downloadFile);

// API ดึงสหกรณ์ตามกลุ่ม
router.get('/coops/:group', controller.getCoopsByGroup);

module.exports = router;
