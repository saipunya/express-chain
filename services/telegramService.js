// services/telegramService.js
const axios = require('axios');

// ใส่ TOKEN ของ Bot และ CHAT_ID ของกลุ่ม
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendMessage(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('✅ ส่งข้อความ Telegram เรียบร้อย');
  } catch (error) {
    console.error('❌ ส่งข้อความ Telegram ไม่สำเร็จ:', error.message);
  }
}

module.exports = { sendMessage };
