// config/db.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

(async () => {
  try {
    const conn = await db.getConnection();
    console.log('✅ Database connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.code, err.message);
  }
})();

process.on('SIGINT', async () => {
  try {
    await db.end();
    console.log('🛑 DB pool closed');
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
});

module.exports = db;

