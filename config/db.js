// config/db.js

const mysql = require('mysql2/promise');

// โหลดตัวแปรจาก .env
require('dotenv').config();

// สร้าง connection
const db = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT || 3306,
});
// ทดสอบการเชื่อมต่อ
db.getConnection()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

module.exports = db;

