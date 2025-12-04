require('dotenv').config();
const axios = require('axios');
const dayjs = require('dayjs');
require('dayjs/locale/th');
dayjs.locale('th');
const activityModel = require('../models/activityModel');

async function sendDailyNotify() {
  const today = dayjs().format('YYYY-MM-DD');

  try {
    const activities = await activityModel.getActivitiesByDate(today);

    if (!activities || activities.length === 0) {
      console.log(`ไม่มีรายการกิจกรรมในวันที่ ${today}`);
      return;
    }

    let message = `📅 แจ้งเตือนกิจกรรมประจำวันที่ ${dayjs(today).format('D MMMM BBBB')} :\n`;

    activities.forEach((act, index) => {
      message += `\n${index + 1}. ${act.activity}`;
      message += `\n🕒 เวลา: ${act.act_time || '-'}\n📍 สถานที่: ${act.place || '-'}\n👥 ผู้รับผิดชอบ: ${act.co_person || '-'}\nหมายเหตุ: ${act.comment || '-'}\n`;
    });

    const telegramUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
    await axios.post(telegramUrl, {
      chat_id: process.env.CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    });

    console.log('ส่งข้อความแจ้งเตือนกิจกรรมเรียบร้อยแล้ว');
  } catch (err) {
    console.error('เกิดข้อผิดพลาดในการส่งข้อความแจ้งเตือนกิจกรรม:', err.message);
  }
}

if (require.main === module) {
  sendDailyNotify();
}

module.exports = { sendDailyNotify };

// cron/activityNotifier.js
const cron = require('node-cron');
const { sendDailyNotify } = require('./dailyTelegramNotify');

const TZ = process.env.TZ || 'Asia/Bangkok';

console.log(`⏰ ตั้งเวลาแจ้งเตือนกิจกรรมทุกวัน 06:35 น. (timezone: ${TZ})`);

const job = cron.schedule(
  '35 6 * * *',   // นาที 35 ชั่วโมง 6 ทุกวัน
  async () => {
    const start = new Date();
    console.log(`🚀 [Cron] เริ่มส่งแจ้งเตือนกิจกรรม: ${start.toISOString()}`);
    try {
      await sendDailyNotify();
      console.log('✅ [Cron] ส่งแจ้งเตือนกิจกรรมเสร็จสมบูรณ์');
    } catch (e) {
      console.error('❌ [Cron] ส่งแจ้งเตือนกิจกรรมล้มเหลว:', e);
    }
  },
  { timezone: TZ }
);

module.exports = job;

// app.js
require('./cron/gitgumNotifier');
require('./cron/activityNotifier');  // <- เพิ่มบรรทัดนี้
