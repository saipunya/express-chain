const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');

router.get('/run-cron', async (req, res) => {
  try {
    const message = `แจ้งเตือนกิจกรรมประจำวัน เวลา ${new Date().toLocaleString('th-TH')}`;
    await telegramService.sendMessage(message);
    return res.send('ส่งข้อความแจ้งเตือนเรียบร้อยแล้ว');
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน:', error.message);
    return res.status(500).send('เกิดข้อผิดพลาดในการส่งแจ้งเตือน: ' + error.message);
  }
});

module.exports = router;
