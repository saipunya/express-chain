const axios = require('axios');
const activityModel = require('../models/activityModel');

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

exports.buildTodayActivityMessage = async () => {
  const activities = await activityModel.getActivitiesForToday();
  if (!activities || activities.length === 0) return null;
  let message = '📅 กิจกรรมประจำวันที่วันนี้\n';
  activities.forEach((act, index) => {
    message += `\n${index + 1}. ${act.activity || '-'}\n`;
    if (act.date_act) message += `   วันที่: ${act.date_act}\n`;
    if (act.act_time) message += `   เวลา: ${act.act_time}\n`;
    if (act.place) message += `   สถานที่: ${act.place}\n`;
    if (act.co_person) message += `   ผู้รับผิดชอบ: ${act.co_person}\n`;
  });
  return message;
};

exports.notifyActivityToday = async () => {
  const message = await exports.buildTodayActivityMessage();
  if (!message) {
    console.log('ไม่มีรายการกิจกรรมสำหรับวันนี้ ไม่ส่งแจ้งเตือน');
    return;
  }
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token) throw new Error('LINE_NOTIFY_TOKEN is missing in .env');
  await axios.post(
    'https://notify-api.line.me/api/notify',
    new URLSearchParams({ message }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  console.log('✅ ส่งการแจ้งเตือนกิจกรรมวันนี้เรียบร้อย');
};