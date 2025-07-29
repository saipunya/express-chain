// scripts/hashExistingPasswords.js

const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function updateAllPasswords() {
  try {
    const [users] = await db.query('SELECT m_id, m_pass FROM member3');

    for (const user of users) {
      // เช็คว่า hash แล้วหรือยัง (optional)
      if (!user.m_pass.startsWith('$2a$')) {
        const [users] = await db.query('SELECT m_id, m_pass FROM member3');

for (const user of users) {
  if (!user.m_pass.startsWith('$2a$')) {
    const hashed = await bcrypt.hash(user.m_pass, 10);

    await db.query('UPDATE member3 SET m_pass = ? WHERE m_id = ?', [
      hashed,
      user.m_id,
    ]);

    console.log(`Updated password for user ID: ${user.m_id}`);
  }
}
      }
    }

    console.log('All passwords updated to hashed format.');
  } catch (err) {
    console.error('Error updating passwords:', err);
  } finally {
    db.end();
  }
}

updateAllPasswords();
