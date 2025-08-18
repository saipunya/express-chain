// cron/gitgumNotifier.js
const cron = require('node-cron');
const gitgumModel = require('../models/gitgumModel');
const telegram = require('../services/telegramService');

// ฟังก์ชันส่งข้อความกิจกรรมวันนี้
async function notifyGitgum() {
  const events = await gitgumModel.findToday();

  if (events.length === 0) {
    console.log('❌ ไม่มีรายการกิจกรรมวันนี้');
    return;
  }

  for (const g of events) {
    const dateTH = new Intl.DateTimeFormat('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(g.git_date));


    const msg = `
📌 <b>${g.git_act}</b>
🗓 วันที่: ${dateTH}

⏰ เวลา: ${g.git_time}
📍 สถานที่: ${g.git_place}
👥 ผู้ไป: ${g.git_goto || '-'}
ผู้รับผิดชอบ: ${g.git_respon || '-'}
    `;
    await telegram.sendMessage(msg);
    console.log('✅ ส่งแล้ว:', g.git_act);
  }
}

// ตั้ง cron schedule ทุกวัน 04:00
cron.schedule('0 4 * * *', notifyGitgum, {
  timezone: 'Asia/Bangkok'
});

// สำหรับทดสอบสามารถเรียก run ตอนนี้เลย
//notifyGitgum();

module.exports = notifyGitgum;
