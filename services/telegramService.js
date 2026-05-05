// services/telegramService.js
const axios = require('axios');

function getTelegramConfig(target = 'default') {
  if (target === 'workflow') {
    return {
      token:
        process.env.LASYSTEM_BOT_TOKEN ||
        process.env.TELEGRAM_WORKFLOW_BOT_TOKEN ||
        process.env.TELEGRAM_BOT_TOKEN,
      chatId:
        process.env.LASYSTEM_BOT_CHAT_ID ||
        process.env.TELEGRAM_WORKFLOW_CHAT_ID ||
        process.env.TELEGRAM_CHAT_ID
    };
  }

  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  };
}

async function sendMessage(message, options = {}) {
  const { target = 'default', replyMarkup = null } = options;
  const { token, chatId } = getTelegramConfig(target);

  if (!token || !chatId) {
    console.error(
      'TELEGRAM config missing: set TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID or LASYSTEM_BOT_TOKEN/LASYSTEM_BOT_CHAT_ID'
    );
    return;
  }

  const MAX_LENGTH = 4096;
  const parts = [];
  for (let i = 0; i < message.length; i += MAX_LENGTH) {
    parts.push(message.slice(i, i + MAX_LENGTH));
  }

  try {
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isLastPart = index === parts.length - 1;
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: part,
        parse_mode: 'HTML',
        ...(replyMarkup && isLastPart ? { reply_markup: replyMarkup } : {})
      });
    }

    console.log(`[telegram:${target}] sent ${parts.length} message part(s)`);
  } catch (error) {
    console.error(`[telegram:${target}] send failed:`, error.message);
  }
}

module.exports = { sendMessage };
