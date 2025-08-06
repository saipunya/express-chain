// routes/cronRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8266049965:AAEN80HAjOn6n3Mf2jYKy4oEeCSxQNyBw2g';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002391968125';

router.get('/run-cron', async (req, res) => {
  try {
    const message = `แจ้งเตือนกิจกรรมวันนี้เวลา ${new Date().toLocaleString('th-TH')}`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });

    res.send('ส่งข้อความแจ้งเตือนเรียบร้อยแล้ว');
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error.message);
    res.status(500).send('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
  }
});

module.exports = router;
