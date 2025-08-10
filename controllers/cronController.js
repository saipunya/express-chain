const axios = require('axios');

exports.runCron = async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const message = '📣 แจ้งเตือนกิจกรรมวันนี้จากระบบ CoopChain';

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message
    });

    console.log('ส่งข้อความสำเร็จ:', response.data);

    return res.send('ส่งแจ้งเตือนเรียบร้อยแล้ว'); // ✅ ใส่ return
  } catch (error) {
    console.error(
      'เกิดข้อผิดพลาดในการส่งแจ้งเตือน:',
      error.response?.data || error.message
    );

    return res.status(500).send(
      'เกิดข้อผิดพลาดในการส่งแจ้งเตือน: ' +
      (error.response?.data?.description || error.message)
    ); // ✅ ใส่ return
  }
};