const gitgumModel = require('../models/gitgumModel');
const telegram = require('./telegramService');
const line = require('./lineService'); // เพิ่ม LINE service

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

    // ข้อความสำหรับ LINE (plain text, ไม่รองรับ HTML)
    const lineMsg = [
      `📌 ${g.git_act}`,
      `🗓 วันที่: ${dateTH}`,
      '',
      `⏰ เวลา: ${g.git_time}`,
      `📍 สถานที่: ${g.git_place}`,
      `👥 ผู้ไป: ${g.git_goto || '-'}`,
      `ผู้รับผิดชอบ: ${g.git_respon || '-'}`,
    ].join('\n');

    await telegram.sendMessage(msg);
    await line.pushText(lineMsg); // ส่งไป LINE
    console.log('✅ ส่งแล้ว:', g.git_act);
  }
}

module.exports = { notifyGitgum };
