const express = require('express');
const router = express.Router();
const line = require('../services/lineService');
const gitgumModel = require('../models/gitgumModel');
const notify = require('../services/notifyService'); // แก้ path ให้ถูก

// ใช้ JSON parser สำหรับ webhook นี้
router.post('/webhook/line', express.json(), async (req, res) => {
    const events = req.body?.events || [];

    await Promise.all(
        events.map(async (event) => {
            // ฟังก์ชันส่งข้อความกิจกรรมวันนี้
            async function notifyGitgum() {
                const events = await gitgumModel.findToday();

                if (events.length === 0) {
                    console.log('❌ ไม่มีรายการกิจกรรมวันนี้');
                    return;
                }

                for (const g of events) {
                    const dateTH = new Intl.DateTimeFormat('th-TH', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }).format(new Date(g.git_date));

                    const msg = `
📌 <b>${g.git_act}</b>
🗓 วันที่: ${dateTH}

⏰ เวลา: ${g.git_time}
📍 สถานที่: ${g.git_place}
👥 ผู้ไป: ${g.git_goto || '-'}
ผู้รับผิดชอบ: ${g.git_respon || '-'}
                    `;

                    const lineMsg = [
                        `📌 ${g.git_act}`,
                        `🗓 วันที่: ${dateTH}`,
                        '',
                        `⏰ เวลา: ${g.git_time}`,
                        `📍 สถานที่: ${g.git_place}`,
                        `👥 ผู้ไป: ${g.git_goto || '-'}`,
                        `ผู้รับผิดชอบ: ${g.git_respon || '-'}`,
                    ].join('\n');

                    // ส่งข้อความผ่าน LINE
                    await line.pushText(lineMsg); // ใช้ pushText

                    // ส่งข้อความผ่าน notify (Telegram + LINE)
                    await notify.broadcast({ html: msg, text: lineMsg });

                    console.log('✅ ส่งแล้ว:', g.git_act);
                }
            }
        })
    );

    res.sendStatus(200);
});

module.exports = router;
