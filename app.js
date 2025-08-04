const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan')

require('dotenv').config();

// Import middleware
const { setUserLocals } = require('./middlewares/authMiddleware');

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(morgan('dev'));

app.use((req, res, next) => {
  res.locals.title = 'CoopChain ชัยภูมิ'; // ค่า default
  next();
});
// require routes/index.js
require('./routes/index')(app);
// when not routes found, it will return 404 button to home page
app.use((req, res) => {
  res.status(404).render('error_page', {
    message: 'เส้นทางที่คุณเข้าถึงไม่มีอยู่ในระบบ'
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



// เริ่ม server
const PORT = 5500;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
