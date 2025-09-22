const express = require('express');
const router = express.Router();
const controller = require('../controllers/memberCoopController');

// หน้า home (สรุป)
router.get('/', controller.home);

// หน้าแสดงรายการ + ค้นหา (optional ?q=)
router.get('/members', controller.list);

// รายละเอียด item
router.get('/members/:idx', controller.detail);

module.exports = router;
