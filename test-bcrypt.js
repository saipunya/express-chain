const bcrypt = require('bcryptjs');

const hashed = '$2b$10$4xv9VoSTV3/0ifo5CKnVY.xshXyLVjmnAatxI7sX3MXcBzMoB8E6C'; // ตัวอย่าง hash
const password = '123456'; // รหัสผ่านจริงที่ user ควรใส่ตอน login

bcrypt.compare(password, hashed).then(result => {
  console.log('รหัสผ่านตรงกันไหม:', result); // true หรือ false
});
