// cron/gitgumNotifier.js
const cron = require('node-cron');
const { notifyGitgum } = require('../services/gitgumNotificationService');

// ตั้ง cron schedule ทุกวัน 04:00
cron.schedule('0 4 * * *', notifyGitgum, {
  timezone: 'Asia/Bangkok'
});

// สำหรับทดสอบสามารถเรียก run ตอนนี้เลย
// notifyGitgum();

module.exports = notifyGitgum;
