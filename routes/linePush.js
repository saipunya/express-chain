const express = require('express');
const router = express.Router();
const line = require('../services/lineService');

// GET /line/push?text=ข้อความ&to=<userId|groupId|roomId>
router.get('/line/push', async (req, res) => {
  const { text = 'ทดสอบส่ง LINE จากระบบ', to } = req.query;
  try {
    await line.pushText(text, to);
    res.json({ ok: true, message: 'Pushed to LINE', to: to || process.env.LINE_TO });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /line/push  body: { text: string | string[], to?: string }
router.post('/line/push', async (req, res) => {
  const { text, to } = req.body || {};
  if (!text) return res.status(400).json({ ok: false, error: 'text is required' });
  try {
    await line.pushText(text, to);
    res.json({ ok: true, message: 'Pushed to LINE', to: to || process.env.LINE_TO });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
