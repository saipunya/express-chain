require('dotenv').config();
const gitgumModel = require('./models/gitgumModel');
const axios = require('axios');
const dayjs = require('dayjs');
require('dayjs/locale/th');
dayjs.locale('th');

async function notifyTodayEvents() {
  const today = dayjs().format('YYYY-MM-DD');
  try {
    const [rows] = await gitgumModel.findByDate(today);
    if (rows.length === 0) {
      console.log(`ไม่มีงานในวันที่ ${today}`);
      return;
    }

    let message = `📅 แจ้งเตือนกิจกรรมประจำวันที่ ${dayjs(today).format('D MMMM BBBB')}:\n`;
    rows.forEach((event, index) => {
      message += `\n${index + 1}. ${event.git_title}\n📝 ${event.git_detail}\n`;
    });

    const telegramUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
    await axios.post(telegramUrl, {
      chat_id: process.env.CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    });

    console.log('ส่งข้อความแจ้งเตือนเรียบร้อยแล้ว');
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการส่งข้อความ:', err.message);
  }
}

// รันเมื่อไฟล์ถูกเรียกโดยตรง
if (require.main === module) {
  notifyTodayEvents();
}

module.exports = { notifyTodayEvents };
