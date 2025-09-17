const express = require('express');
const router = express.Router();
const notify = require('../services/notifyService');

// GET: quick test message
router.get('/notify/test', async (req, res) => {
  const now = new Date();
  const dateTH = new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(now);

  const html = `
📢 <b>ทดสอบการแจ้งเตือน</b>
🗓 วันที่/เวลา: ${dateTH}

ข้อความ: ระบบทดสอบส่งแจ้งเตือนไปยัง Telegram และ LINE สำเร็จ
  `.trim();

  const text = [
    '📢 ทดสอบการแจ้งเตือน',
    `🗓 วันที่/เวลา: ${dateTH}`,
    '',
    'ข้อความ: ระบบทดสอบส่งแจ้งเตือนไปยัง Telegram และ LINE สำเร็จ',
  ].join('\n');

  try {
    await notify.broadcast({ html, text });
    res.json({ ok: true, message: 'Sent test notification to Telegram and LINE' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST: custom message
// body: { html?: string, text?: string } or fields to compose
router.post('/notify/test', async (req, res) => {
  const { html, text, title, date, time, place, goto, respon } = req.body || {};
  try {
    if (html || text) {
      await notify.broadcast({ html, text });
      return res.json({ ok: true, message: 'Sent custom notification' });
    }
    const dateDisp = date || new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
    const htmlMsg = `
📌 <b>${title || 'ทดสอบ'}</b>
🗓 วันที่: ${dateDisp}

⏰ เวลา: ${time || '-'}
📍 สถานที่: ${place || '-'}
👥 ผู้ไป: ${goto || '-'}
ผู้รับผิดชอบ: ${respon || '-'}
    `.trim();

    const textMsg = [
      `📌 ${title || 'ทดสอบ'}`,
      `🗓 วันที่: ${dateDisp}`,
      '',
      `⏰ เวลา: ${time || '-'}`,
      `📍 สถานที่: ${place || '-'}`,
      `👥 ผู้ไป: ${goto || '-'}`,
      `ผู้รับผิดชอบ: ${respon || '-'}`,
    ].join('\n');

    await notify.broadcast({ html: htmlMsg, text: textMsg });
    res.json({ ok: true, message: 'Sent composed notification' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
