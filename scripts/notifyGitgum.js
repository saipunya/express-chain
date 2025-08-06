require('dotenv').config();
const gitgumModel = require('../models/gitgumModel');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });
}

async function notifyTodayEvents() {
  try {
    const events = await gitgumModel.findToday();

    if (events.length === 0) {
      console.log('✅ No events today');
      return;
    }

    for (const event of events) {
      const msg = `📅 <b>กิจกรรมวันนี้</b>\n\n📝 <b>${event.git_act}</b>\n📍 ${event.git_place}\n⏰ ${event.git_time}\n👤 ${event.git_respon}`;
      await sendTelegramMessage(msg);
    }
    console.log('📢 Notification sent');
  } catch (err) {
    console.error('❌ Failed to send notification:', err);
  }
}

notifyTodayEvents();
