const express = require('express');
const router = express.Router();
const addmemController = require('../controllers/addmemController');

// แสดงรายการ (พร้อม pagination)
router.get('/list', addmemController.list);

// แสดงฟอร์มเพิ่ม
router.get('/add', addmemController.showAddForm);

// บันทึกข้อมูลใหม่
router.post('/save', addmemController.saveAddmem);

// แสดงรายละเอียด
router.get('/view/:id', addmemController.viewOne);

// แสดงฟอร์มแก้ไข
router.get('/edit/:id', addmemController.showEditForm);

// อัปเดตข้อมูล
router.post('/update/:id', addmemController.updateAddmem);

// ลบข้อมูล
router.get('/delete/:id', addmemController.deleteAddmem);

// API สำหรับค้นหาตามรหัส (AJAX)
router.get('/search', addmemController.searchByCode);

module.exports = router;
