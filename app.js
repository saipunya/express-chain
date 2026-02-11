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
  secret: process.env.SESSION_SECRET || 'pmpilaiwan',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Make `user` available in all EJS views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

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

// Audit log (management actions)
app.use(require('./middlewares/auditLogger')());

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
const bahtText = require('./utils/bahtText');

app.use((req, res, next) => {
  res.locals.title = '++ CoopChain : ระบบสารสนเทศและเครือข่ายสหกรณ์ในจังหวัดภูมิ';
  res.locals.bahtText = bahtText; // make helper available in all views
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
const planProjectRoutes = require('./routes/planProjectRoutes'); // โครงการ
const planKpiRoutes = require('./routes/planKpiRoutes'); // ตัวชี้วัดโครงการ
const memberCoopRoutes = require('./routes/memberCoopRoutes'); // เพิ่ม
const rabiabRoutes = require('./routes/rabiabRoutes'); // เพิ่ม route rabiab
const addmemRoutes = require('./routes/addmemRoutes'); // เพิ่ม route addmem

// Public routes that don't require authentication
const publicRoutes = [
  '/chamra/process',
  '/chamra/detail/:id', // optional: also allow viewing details
  // ...other public routes
];

// online member
app.use(onlineStatus);
app.use(lineWebhook);
app.use(notifyTest); // ใช้งานเส้นทางทดสอบ
app.use(gitgumTest); // ใช้งานเส้นทางทดสอบ gitgum
app.use(linePush);   // ใช้งานเส้นทางส่ง LINE
app.use('/member', memberRoutes); // ใช้งานเส้นทางสมาชิก
app.use('/plan', planMainRoutes); // add this with other app.use(...) routes
app.use('/planproject', planProjectRoutes); // เส้นทางจัดการโครงการ
app.use('/planKpi', planKpiRoutes); // เส้นทางจัดการตัวชี้วัดโครงการ
app.use('/plan_project', (req, res) => res.redirect('/planproject')); // Redirect old path
app.use('/', memberCoopRoutes); // เพิ่ม เพื่อให้หน้า home และ members ถูกให้บริการ
app.use('/rabiab', rabiabRoutes); // ใช้งานเส้นทาง rabiab (ดาวน์โหลดไฟล์ระเบียบ)
app.use('/addmem', addmemRoutes); // ใช้งานเส้นทาง addmem (สมาชิกเพิ่มเติม)
app.use('/chamra', chamraExportRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error_page', {
    message: 'เส้นทางเข้าไม่อยู่ในระบบ'
  });
});

// อย่าง cron job ส่ง Telegram
require('./cron/gitgumNotifier');
require('./cron/dailyTelegramNotify'); // <- เพิ่มบรรทัดนี้
require('./cron/auditLogRetention');

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




// // เล่ม server
// const DEFAULT_PORT = parseInt(process.env.PORT || '5500', 10);
// let port = DEFAULT_PORT;
// let attempts = 0;
// const maxAttempts = 5;

// function start(p){
//   server.listen(p, () => {
//     console.log(`✅ Server is running on http://localhost:${p}`);
//   });
// }

// server.on('error', (err) => {
//   if (err && err.code === 'EADDRINUSE' && attempts < maxAttempts) {
//     console.warn(`⚠️ Port ${port} is in use. Retrying on ${port + 1}...`);
//     attempts += 1;
//     port += 1;
//     setTimeout(() => start(port), 300);
//     return;
//   }
//   console.error('Server error:', err);
//   process.exit(1);
// });

// start(port);

const PORT = process.env.PORT;

if (!PORT) {
  console.error('❌ PORT is not defined');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Server running on port ${PORT}`);
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
  'uploads/vong', // added for vong files
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});




