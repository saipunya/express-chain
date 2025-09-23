const path = require('path');
const express = require('express');
const router = express.Router();
const generateChamraReport = require('../utils/pdf/chamraReport');

// POST: client sends { q, rows: [ { code, name, status, person, latestStepNumber, latestStepDate, percent } ] }
router.post('/export/pdf', async (req, res, next) => {
  try {
    const { q = '', rows = [], generatedAt } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to export' });
    }

    const u = (res.locals && res.locals.user) || (req.session && req.session.user) || {};
    const printedBy =
      u.name || u.fullName || u.displayName || u.username || u.u_name || u.m_name || '';

    await generateChamraReport(res, { q, rows, generatedAt, printedBy });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
