// config/db.js

const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'express_chain',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000, // Increased timeout
  acquireTimeout: 30000,  // Added acquire timeout
  timeout: 60000,         // Added query timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4', // ensure driver requests utf8mb4
  reconnect: true,       // Auto-reconnect
  idleTimeout: 300000,   // 5 minutes idle timeout
  maxIdle: 5            // Max idle connections
});

// Force connection session to utf8mb4 every time
db.on('connection', (conn) => {
  conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

db.on('error', (err) => {
  console.error('Database connection error:', err); // Log connection errors
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

