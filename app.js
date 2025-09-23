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
const chamraExportRoute = require('./routes/chamraExport');
// const methodOverride = require('method-override'); // replaced by safe loader below

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
app.use(express.json({ limit: '2mb' }));

// method-override: prefer installed package, otherwise use lightweight fallback
let methodOverridePkg = null;
try {
  methodOverridePkg = require('method-override');
} catch (e) {
  console.warn('method-override not installed — using fallback middleware. To use official package run: npm install method-override');
}

if (methodOverridePkg) {
  app.use(methodOverridePkg('_method'));
  app.use(methodOverridePkg((req) => req.query._method));
} else {
  // Fallback: look for _method in body or query and override req.method
  app.use((req, res, next) => {
    // body parser runs before this, so req.body is available
    const fromBody = req.body && req.body._method;
    const fromQuery = req.query && req.query._method;
    const method = (fromBody || fromQuery || '').toString().toUpperCase();
    if (method && ['DELETE', 'PUT', 'PATCH'].includes(method)) {
      req.method = method;
    }
    next();
  });
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(setUserLocals);
app.use(updateOnlineTime); 

// เพิ่มบรรทัดนี้เพื่อเตรียม summaryByYear/top ให้ทุก view (อ่าน member6667.json)
app.use(require('./middlewares/memberCoopLocals'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(morgan('dev'));
const onlineStatus = require('./middlewares/onlineMiddleware');

app.use((req, res, next) => {
  res.locals.title = '++ CoopChain : ระบบสารสนเทศและเครือข่ายสหกรณ์ในจังหวัดภูมิ';
  next();
});

// เรียกใช้ routes/index.js
require('./routes/index')(app);

const lineWebhook = require('./routes/lineWebhook'); // route รับข้อความจาก LINE
const notifyTest = require('./routes/notifyTest'); // route ทดสอบแจ้งเตือน
const gitgumTest = require('./routes/gitgumTest'); // ทดสอบดึงข้อมูล gitgum
const linePush = require('./routes/linePush'); // ส่ง LINE โดยตรง
const memberRoutes = require('./routes/memberRoutes'); // route สมาชิก
const planMainRoutes = require('./routes/planMainRoutes'); // add this near other route requires
const memberCoopRoutes = require('./routes/memberCoopRoutes'); // เพิ่ม

// online member
app.use(onlineStatus);
app.use(lineWebhook);
app.use(notifyTest); // ใช้งานเส้นทางทดสอบ
app.use(gitgumTest); // ใช้งานเส้นทางทดสอบ gitgum
app.use(linePush);   // ใช้งานเส้นทางส่ง LINE
app.use('/member', memberRoutes); // ใช้งานเส้นทางสมาชิก
app.use('/plan', planMainRoutes); // add this with other app.use(...) routes
app.use('/', memberCoopRoutes); // เพิ่ม เพื่อให้หน้า home และ members ถูกให้บริการ
app.use('/chamra', chamraExportRoute);

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




