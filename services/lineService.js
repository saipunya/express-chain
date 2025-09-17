const axios = require('axios');

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const DEFAULT_TO = process.env.LINE_TO;

async function pushText(texts, to = DEFAULT_TO) {
    if (!ACCESS_TOKEN || !to) {
      console.error('❌ LINE config missing: set LINE_CHANNEL_ACCESS_TOKEN and LINE_TO');
      return;
    }
    const messages = Array.isArray(texts)
      ? texts.map(t => ({ type: 'text', text: t }))
      : [{ type: 'text', text: texts }];
  
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        { to, messages },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ ส่ง LINE เรียบร้อย');
    } catch (err) {
      console.error('❌ ส่ง LINE ไม่สำเร็จ:', err.response?.data || err.message);
    }
  }

async function replyText(replyToken, texts) {
  if (!ACCESS_TOKEN || !replyToken) {
    console.error('❌ LINE config missing: set LINE_CHANNEL_ACCESS_TOKEN and provide replyToken');
    return;
  }
  const messages = Array.isArray(texts)
    ? texts.map(t => ({ type: 'text', text: t }))
    : [{ type: 'text', text: texts }];

  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      { replyToken, messages },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ ตอบกลับ LINE webhook เรียบร้อย');
  } catch (err) {
    console.error('❌ ตอบกลับ LINE ไม่สำเร็จ:', err.response?.data || err.message);
  }
}

module.exports = { pushText, replyText };
