const express = require('express');
const router = express.Router();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

router.get('/run-cron', async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error('TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID ยังไม่ได้ตั้งค่าใน .env');
    }

    const message = `แจ้งเตือนกิจกรรมวันนี้เวลา ${new Date().toLocaleString('th-TH')}`;

    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });

    console.log('Telegram response:', response.data);

    res.send('ส่งข้อความแจ้งเตือนเรียบร้อยแล้ว');
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error.message);
    res.status(500).send('เกิดข้อผิดพลาดในการส่งแจ้งเตือน: ' + error.message);
  }
});

module.exports = router;
