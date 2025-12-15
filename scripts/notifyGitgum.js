require('dotenv').config();
const gitgumModel = require('../models/gitgumModel');
const { sendMessage } = require('../services/telegramService');

async function notifyTodayEvents() {
  try {
    const events = await gitgumModel.findToday();

    if (events.length === 0) {
      console.log('✅ No events today');
      return;
    }

    for (const event of events) {
      const msg = `📅 <b>กิจกรรมวันนี้</b>\n\n📝 <b>${event.git_act}</b>\n📍 ${event.git_place}\n⏰ ${event.git_time}\n👤 ${event.git_respon}`;
      await sendMessage(msg);
    }
    console.log('📢 Notification sent');
  } catch (err) {
    console.error('❌ Failed to send notification:', err);
  }
}

notifyTodayEvents();
