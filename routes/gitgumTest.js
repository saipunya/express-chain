const express = require('express');
const router = express.Router();
const gitgumModel = require('../models/gitgumModel');
const { notifyGitgum } = require('../services/gitgumNotificationService');

router.get('/gitgum/test/today', async (req, res) => {
  try {
    const events = await gitgumModel.findToday();
    res.json({ ok: true, count: events.length, events });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/gitgum/test/preview', async (req, res) => {
  try {
    const events = await gitgumModel.findToday();
    const previews = events.map(g => {
      const dateTH = new Intl.DateTimeFormat('th-TH', {
        day: '2-digit', month: 'short', year: 'numeric'
      }).format(new Date(g.git_date));

      const html = `
📌 <b>${g.git_act}</b>
🗓 วันที่: ${dateTH}

⏰ เวลา: ${g.git_time}
📍 สถานที่: ${g.git_place}
👥 ผู้ไป: ${g.git_goto || '-'}
ผู้รับผิดชอบ: ${g.git_respon || '-'}
      `.trim();

      const text = [
        `📌 ${g.git_act}`,
        `🗓 วันที่: ${dateTH}`,
        '',
        `⏰ เวลา: ${g.git_time}`,
        `📍 สถานที่: ${g.git_place}`,
        `👥 ผู้ไป: ${g.git_goto || '-'}`,
        `ผู้รับผิดชอบ: ${g.git_respon || '-'}`,
      ].join('\n');

      return { id: g.id || g.git_id, html, text };
    });

    res.json({ ok: true, count: previews.length, previews });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/gitgum/test/send', async (req, res) => {
  try {
    await notifyGitgum();
    res.json({ ok: true, message: 'Triggered GitGum notifications for today.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
