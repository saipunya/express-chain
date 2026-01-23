// cron/auditLogRetention.js
const cron = require('node-cron');
const db = require('../config/db');

const TZ = process.env.TZ || 'Asia/Bangkok';
const RETENTION_DAYS = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '180', 10);

const safeRetentionDays = Number.isFinite(RETENTION_DAYS) && RETENTION_DAYS > 0 ? RETENTION_DAYS : 180;

console.log(`🧾 ตั้งเวลา cleanup audit_log ทุกวัน 03:20 น. (เก็บย้อนหลัง ${safeRetentionDays} วัน, timezone: ${TZ})`);

const job = cron.schedule(
  '20 3 * * *',
  async () => {
    const start = Date.now();
    try {
      const cutoff = new Date(Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000);
      // MySQL understands JS Date objects via mysql2 parameter binding.
      const [result] = await db.query('DELETE FROM audit_log WHERE created_at < ?', [cutoff]);
      const duration = Date.now() - start;
      console.log(`✅ [Cron] cleanup audit_log ลบไป ${result.affectedRows || 0} แถว ใน ${duration}ms`);
    } catch (e) {
      console.error('❌ [Cron] cleanup audit_log ล้มเหลว:', e);
    }
  },
  { timezone: TZ }
);

module.exports = job;
