const bcrypt = require('bcryptjs');
const db = require('../config/db'); // ปรับ path ตามโปรเจกต์จริง

async function hashPasswords() {
  try {
    // 1. ดึงข้อมูล user ที่รหัสผ่านยังไม่เข้ารหัส (สมมุติว่าเช็คจากความยาว < 60)
    const [users] = await db.query('SELECT m_id, m_pass FROM member3');

    for (const user of users) {
      const currentPass = user.m_pass;

      // เช็คว่า password น่าจะยังไม่ถูก hash (bcrypt hash ปกติยาว ~60 ตัวอักษร)
      if (typeof currentPass === 'string' && currentPass.length < 60) {
        console.log(`กำลังเข้ารหัสรหัสผ่าน user ID: ${user.m_id}`);

        const hashedPass = await bcrypt.hash(currentPass, 10);

        // อัปเดตรหัสผ่านใหม่
        await db.query('UPDATE member3 SET m_pass = ? WHERE m_id = ?', [hashedPass, user.m_id]);

        console.log(`อัปเดตสำเร็จ user ID: ${user.m_id}`);
      } else {
        console.log(`ข้าม user ID: ${user.m_id} (รหัสผ่านถูกเข้ารหัสแล้ว)`);
      }
    }

    console.log('เสร็จสิ้นการเข้ารหัสรหัสผ่านทั้งหมด');
    process.exit(0);
  } catch (err) {
    console.error('เกิดข้อผิดพลาด:', err);
    process.exit(1);
  }
}

hashPasswords();
