const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const onlineModel = require('./models/onlineModel');
const fs = require('fs');

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
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow specific methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow specific headers
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(setUserLocals);
app.use(updateOnlineTime); // <lemmaปเดตเวลาออนไลน์<lemma request
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(morgan('dev'));

app.use((req, res, next) => {
  res.locals.title = 'CoopChain 4'; // ค่า default
  next();
});
// require routes/index.js
require('./routes/index')(app);
// when not routes found, it will return 404 button to home page
app.use((req, res) => {
  res.status(404).render('error_page', {
    message: 'เส้นทางเข้าไม่อยู่ในระบบ'
  });
});

// Routing
// const homeRoutes = require('./routes/homeRoutes');
// const authRoutes = require('./routes/authRoutes');
// const dashboardRoutes = require('./routes/dashboardRoutes');
// const testRoutes = require('./routes/testRoutes');


// app.use('/', homeRoutes);
// app.use(authRoutes);
// app.use('/dashboard', dashboardRoutes);
// app.use('/', testRoutes);



// เล่ม server
const PORT = 5500;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

// ทำความสะอาดข้อมูลออนไลน์เก่า<lemma 5 นา<lemma
setInterval(async () => {
  try {
    await onlineModel.cleanupOldOnlineData();
    console.log('🧹 Cleaned up old online data');
  } catch (error) {
    console.error('Error cleaning up online data:', error);
  }
}, 5 * 60 * 1000); // 5 นา<lemma

// สร้างโฟลเดอร์ uploads หากไม่<|im_start|>
const uploadDirs = [
  'uploads',
  'uploads/rabiab',
  'uploads/finance',
  'uploads/rule'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});
