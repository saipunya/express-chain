const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');               // เล่ม
const { Server } = require('socket.io');   // เล่ม
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
  res.locals.title = '++ CoopChain : ระบบสารสนเทศและเครือข่ายสหกรณ์ในจังหวัดภูมิ';
  next();
});

// เรียกใช้ routes/index.js
require('./routes/index')(app);

const lineWebhook = require('./routes/lineWebhook');
const notifyTest = require('./routes/notifyTest'); // route ทดสอบแจ้งเตือน
const gitgumTest = require('./routes/gitgumTest'); // ทดสอบดึงข้อมูล gitgum
const linePush = require('./routes/linePush'); // ส่ง LINE โดยตรง

// online member
app.use(onlineStatus);
app.use(lineWebhook);
app.use(notifyTest); // ใช้งานเส้นทางทดสอบ
app.use(gitgumTest); // ใช้งานเส้นทางทดสอบ gitgum
app.use(linePush);   // ใช้งานเส้นทางส่ง LINE

// 404 handler
app.use((req, res) => {
  res.status(404).render('error_page', {
    message: 'เส้นทางเข้าไม่อยู่ในระบบ'
  });
});

// อย่าง cron job ส่ง Telegram
require('./cron/gitgumNotifier');

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

// เล่ม server
const PORT = 5500;
server.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// ทำความสะอาดข้อมูลออนไลน์เก่า (5 นาที)
setInterval(async () => {
  try {
    await onlineModel.cleanupOldOnlineData();
    console.log('🧹 Cleaned up old online data');
  } catch (error) {
    console.error('Error cleaning up online data:', error);
  }
}, 5 * 60 * 1000);

// สร้างโฟลเดอร์ uploads หากไม่ (5 นาที)
const uploadDirs = [
  'uploads',
  'uploads/rabiab',
  'uploads/finance',
  'uploads/rule',
  'uploads/business',
  'uploads/project',
  'uploads/rq2',
  'uploads/command',
  'uploads/suggestion',
  'uploads/activity',
  'uploads/down',
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});




