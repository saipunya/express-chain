// สคริปต์นี้ออกแบบให้รันแบบ standalone โดย Cron/Scheduled Task บนโฮสติ้ง
// ตัวอย่างคำสั่งบนโฮสติ้ง (ทุกวัน 04:00)
//   node /home/USER/express-chain/cron/dailyTelegramNotify.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');
const activityModel = require('../models/activityModel');

(async () => {
  try {
    console.log('⏰ Running dailyTelegramNotify via Scheduled Task ...');

    // ดึงกิจกรรมที่มี date_act = วันนี้
    const activities = await activityModel.getActivitiesForToday();

    if (!activities || activities.length === 0) {
      console.log('ไม่มีรายการกิจกรรมสำหรับวันนี้ ไม่ส่งแจ้งเตือน');
      process.exit(0);
    }

    // สร้างข้อความแจ้งเตือนจากกิจกรรมวันนี้
    let message = '📅 กิจกรรมประจำวันที่วันนี้\n';
    activities.forEach((act, index) => {
      // ปรับชื่อ field ตามโครงสร้างตาราง pt_activity จริง
      message += `\n${index + 1}. ${act.activity || '-'}\n`;
      if (act.date_act) message += `   วันที่: ${act.date_act}\n`;
      if (act.act_time) message += `   เวลา: ${act.act_time}\n`;
      if (act.place) message += `   สถานที่: ${act.place}\n`;
      if (act.co_person) message += `   ผู้รับผิดชอบ: ${act.co_person}\n`;
    });

    const token = process.env.LINE_NOTIFY_TOKEN;
    if (!token) {
      console.error('LINE_NOTIFY_TOKEN is missing in .env');
      process.exit(1);
    }

    await axios.post(
      'https://notify-api.line.me/api/notify',
      new URLSearchParams({ message }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log('✅ ส่งการแจ้งเตือนกิจกรรมวันนี้เรียบร้อย');
    process.exit(0);
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดในการส่งการแจ้งเตือน:', err.message || err);
    process.exit(1);
  }
})();
