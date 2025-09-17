const express = require('express');
const router = express.Router();
const line = require('../services/lineService');
const { notifyGitgum } = require('../services/gitgumNotificationService');

// ใช้ JSON parser สำหรับ webhook นี้
router.post('/webhook/line', express.json(), (req, res) => {
  const events = req.body?.events || [];

  // ตอบ 200 ทันที เพื่อไม่ให้ LINE retry
  res.sendStatus(200);

  // ประมวลผลต่อแบบ async
  setImmediate(() => processLineEvents(events).catch(err => {
    console.error('LINE webhook processing error:', err);
  }));
});

async function processLineEvents(events) {
  await Promise.all(events.map(async (event) => {
    const src = event.source || {};
    const isTextMsg = event.type === 'message' && event.message?.type === 'text';
    const text = event.message?.text?.trim().toLowerCase();

    // คำสั่งที่ยอมรับเพื่อสั่งส่งกิจกรรมวันนี้
    const triggers = ['gitgum', '/gitgum', 'notify', '/notify', 'แจ้งกิจกรรม'];

    if (isTextMsg && triggers.some(k => text?.includes(k))) {
      if (event.replyToken) {
        await line.replyText(event.replyToken, '✅ รับคำสั่งแล้ว กำลังส่งแจ้งเตือนกิจกรรมวันนี้...');
      }
      try {
        await notifyGitgum(); // ส่งผ่าน notifyService ไป Telegram + LINE
      } catch (e) {
        console.error('❌ ส่งแจ้งเตือนกิจกรรมล้มเหลว:', e);
      }
      return;
    }

    // คำสั่งดู ID ของห้อง (ช่วย debug)
    if (isTextMsg && ['id', 'group', 'room'].some(k => text?.includes(k)) && event.replyToken) {
      let idLabel = 'userId';
      let id = src.userId;
      if (src.type === 'group') { idLabel = 'groupId'; id = src.groupId; }
      else if (src.type === 'room') { idLabel = 'roomId'; id = src.roomId; }
      await line.replyText(event.replyToken, `ประเภท: ${src.type}\n${idLabel}: ${id}`);
    }

    console.log(`LINE source: ${src.type} ${src.groupId || src.roomId || src.userId || ''}`);
  }));
}

module.exports = router;
