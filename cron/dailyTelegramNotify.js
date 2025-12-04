require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');
require('dayjs/locale/th');
dayjs.locale('th');

// ตัวอย่างข้อความแจ้งเตือน สามารถแก้ให้ดึงจาก DB ได้ภายหลัง
async function sendDailyNotify() {
  const now = dayjs().format('YYYY-MM-DD HH:mm');
  const message = `⏰ แจ้งเตือนประจำวันเวลา 04:29 น.\nเวลารัน: ${now}`;

  try {
    const telegramUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
    await axios.post(telegramUrl, {
      chat_id: process.env.CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    });
    console.log('ส่งข้อความแจ้งเตือน 04:29 น. เรียบร้อยแล้ว');
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการส่งข้อความแจ้งเตือน 04:29 น.:', err.message);
  }
}

if (require.main === module) {
  sendDailyNotify();
}

module.exports = { sendDailyNotify };
