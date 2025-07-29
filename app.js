const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const db = require('./config/db');

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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(setUserLocals);
app.use((req, res, next) => {
  res.locals.title = 'CoopChain ชัยภูมิ'; // ค่า default
  next();
});

// Routing
const homeRoutes = require('./routes/homeRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const testRoutes = require('./routes/testRoutes');




app.use('/', homeRoutes);
app.use(authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/', testRoutes);
// เริ่ม server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
