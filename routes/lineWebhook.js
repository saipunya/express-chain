const express = require('express');
const router = express.Router();
const line = require('../services/lineService');

// ใช้ JSON parser สำหรับ webhook นี้
router.post('/webhook/line', express.json(), async (req, res) => {
  const events = req.body?.events || [];

  await Promise.all(
    events.map(async (e) => {
      const src = e.source || {};
      let idLabel = 'userId';
      let id = src.userId;
      if (src.type === 'group') {
        idLabel = 'groupId';
        id = src.groupId;
      } else if (src.type === 'room') {
        idLabel = 'roomId';
        id = src.roomId;
      }

      console.log(`LINE source: ${src.type} | ${idLabel}: ${id}`);

      // ตอบกลับในห้องที่เรียกมา เพื่อให้เห็น ID ทันที
      if (e.replyToken) {
        const reply = [`ประเภท: ${src.type}`, `${idLabel}: ${id}`].join('\n');
        await line.replyText(e.replyToken, reply);
      }
    })
  );

  res.sendStatus(200);
});

module.exports = router;
