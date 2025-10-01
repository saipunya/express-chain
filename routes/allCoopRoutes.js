const express = require('express');
const router = express.Router();
const allCoopController = require('../controllers/allCoopController');

// โปรไฟล์สหกรณ์ตามรหัส
router.get('/profile/:c_code', allCoopController.profile);

// แสดงรายชื่อสหกรณ์ทั้งหมด (ไม่มี group ระบุ)
router.get('/group', allCoopController.byGroup);
// แสดงรายชื่อสหกรณ์ตามกลุ่ม (ระบุ group)
router.get('/group/:group', allCoopController.byGroup);

module.exports = router;