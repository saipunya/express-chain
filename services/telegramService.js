// services/telegramService.js
const axios = require('axios');

function getTelegramConfig(target = 'default') {
  if (target === 'workflow') {
    return {
      token: process.env.TELEGRAM_WORKFLOW_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_WORKFLOW_CHAT_ID || process.env.TELEGRAM_CHAT_ID
    };
  }

  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  };
}

async function sendMessage(message, options = {}) {
  const { target = 'default' } = options;
  const { token, chatId } = getTelegramConfig(target);

  if (!token || !chatId) {
    console.error('❌ TELEGRAM config missing: set TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID or TELEGRAM_WORKFLOW_BOT_TOKEN/TELEGRAM_WORKFLOW_CHAT_ID');
    return;
  }

  const MAX_LENGTH = 4096;
  const parts = [];
  for (let i = 0; i < message.length; i += MAX_LENGTH) {
    parts.push(message.slice(i, i + MAX_LENGTH));
  }

  try {
    for (const part of parts) {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: part,
        parse_mode: 'HTML',
      });
    }
    console.log('✅ ส่งข้อความ Telegram (แบบหลายตอน) เรียบร้อย');
  } catch (error) {
    console.error('❌ ส่งข้อความ Telegram ไม่สำเร็จ:', error.message);
  }
}

module.exports = { sendMessage };
