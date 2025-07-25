// config/db.js

const mysql = require('mysql2');

// โหลดตัวแปรจาก .env
require('dotenv').config();

// สร้าง connection
const db = mysql.createConnection({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT || 3306,
});

// ทดสอบการเชื่อมต่อ
db.connect((err) => {
  if (err) {
    console.error('❌ เชื่อมต่อฐานข้อมูลล้มเหลว:', err.message);
  } else {
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ');
  }
});

module.exports = db;
