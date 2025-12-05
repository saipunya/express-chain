// cron/dailyTelegramNotify.js
const cron = require('node-cron');
const { notifyActivityToday } = require('../controllers/cronController');

const TZ = process.env.TZ || 'Asia/Bangkok';
console.log(`⏰ ตั้งเวลาแจ้งเตือน Activity ทุกวัน 04:30 น. (timezone: ${TZ})`);

const job = cron.schedule(
  '30 7 * * *',
  async () => {
    const start = new Date();
    console.log(`🚀 [Cron] เริ่มส่งแจ้งเตือน Activity: ${start.toISOString()}`);
    try {
      await notifyActivityToday();
      console.log('✅ [Cron] ส่งแจ้งเตือน Activity เสร็จสมบูรณ์');
    } catch (e) {
      console.error('❌ [Cron] ส่งแจ้งเตือน Activity ล้มเหลว:', e);
    }
  },
  { timezone: TZ }
);

// เริ่มทำงานอัตโนมัติเมื่อถูก require จาก app.js
module.exports = job;
