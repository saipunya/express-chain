const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');               // เพิ่ม
const { Server } = require('socket.io');   // เพิ่ม
const onlineModel = require('./models/onlineModel');
const fs = require('fs');
const axios = require('axios');

require('dotenv').config();

// Import middleware
const { setUserLocals, updateOnlineTime } = require('./middlewares/authMiddleware');

// Session setup
app.use(session({
  secret: 'pmpilaiwan',
  resave: false,
  saveUninitialized: false
}));

// ตั้งค่า View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(setUserLocals);
app.use(updateOnlineTime); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(morgan('dev'));
const onlineStatus = require('./middlewares/onlineMiddleware');

app.use((req, res, next) => {
  res.locals.title = 'CoopChainReport';
  next();
});

// เรียกใช้ routes/index.js
require('./routes/index')(app);


// online member
app.use(onlineStatus);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error_page', {
    message: 'เส้นทางเข้าไม่อยู่ในระบบ'
  });
});

// ตัวอย่าง cron job ส่ง Telegram
app.get('/run-cron', async (req, res) => {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const message = `แจ้งเตือนกิจกรรมวันนี้เวลา ${new Date().toLocaleString('th-TH')}`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });

    res.send('ส่งข้อความแจ้งเตือนเรียบร้อยแล้ว');
  } catch (error) {
    console.error(error);
    res.status(500).send('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
  }
});

// สร้าง http server แทน app.listen
const server = http.createServer(app);

// ตั้งค่า Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let onlineUsers = 0;

io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('onlineUsers', onlineUsers);
  console.log(`User connected. Online users: ${onlineUsers}`);

  socket.on('disconnect', () => {
    onlineUsers--;
    io.emit('onlineUsers', onlineUsers);
    console.log(`User disconnected. Online users: ${onlineUsers}`);
  });
});

// เริ่ม server
const PORT = 5500;
server.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// ทำความสะอาดข้อมูลออนไลน์เก่า (เหมือนเดิม)
setInterval(async () => {
  try {
    await onlineModel.cleanupOldOnlineData();
    console.log('🧹 Cleaned up old online data');
  } catch (error) {
    console.error('Error cleaning up online data:', error);
  }
}, 5 * 60 * 1000);

// สร้างโฟลเดอร์ uploads หากยังไม่มี (เหมือนเดิม)
const uploadDirs = [
  'uploads',
  'uploads/rabiab',
  'uploads/finance',
  'uploads/rule',
  'uploads/business'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});
