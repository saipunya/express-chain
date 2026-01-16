const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gitgumController');
const { notifyGitgum } = require('../services/gitgumNotificationService');

// Base path is /gitgum from routes/index.js
router.get('/', (req, res) => res.redirect('/gitgum/calendar'));  // Redirect to calendar
router.get('/list', ctrl.list);
router.get('/add', ctrl.showAddForm);
router.post('/add', ctrl.saveGitgum);
router.get('/view/:id', ctrl.viewOne);
router.get('/edit/:id', ctrl.showEditForm);
router.post('/edit/:id', ctrl.updateGitgum);
router.get('/delete/:id', ctrl.deleteGitgum);

// ปฏิทินกิจกรรมทั้งหมด
router.get('/calendar', ctrl.calendarView);

// ปฏิทินกิจกรรมสำหรับมือถือ (standalone - ไม่มี header/footer)
router.get('/mobile', ctrl.mobileCalendarView);

// Route สำหรับ trigger การแจ้งเตือนกิจกรรมวันนี้
router.get('/notify', async (req, res) => {
  try {
    await notifyGitgum();
    res.status(200).send('✅ การแจ้งเตือนกิจกรรมวันนี้สำเร็จ');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการแจ้งเตือน:', error.message);
    res.status(500).send('❌ เกิดข้อผิดพลาดในการแจ้งเตือน');
  }
});

module.exports = router;
