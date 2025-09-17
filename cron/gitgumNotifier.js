// cron/gitgumNotifier.js
const cron = require('node-cron');
const { notifyGitgum } = require('../services/gitgumNotificationService');

const TZ = process.env.TZ || 'Asia/Bangkok';

console.log(`⏰ ตั้งเวลาแจ้งเตือน GitGum ทุกวัน 04:00 น. (timezone: ${TZ})`);

const job = cron.schedule(
  '0 4 * * *',
  async () => {
    const start = new Date();
    console.log(`🚀 [Cron] เริ่มส่งแจ้งเตือน GitGum: ${start.toISOString()}`);
    try {
      await notifyGitgum();
      console.log('✅ [Cron] ส่งแจ้งเตือน GitGum เสร็จสมบูรณ์');
    } catch (e) {
      console.error('❌ [Cron] ส่งแจ้งเตือน GitGum ล้มเหลว:', e);
    }
  },
  { timezone: TZ } // รันตามเขตเวลาไทย
);

// เริ่มทำงานอัตโนมัติเมื่อถูก require จาก app.js
module.exports = job;
