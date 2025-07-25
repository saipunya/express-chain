const express = require('express');
const app = express();
const path = require('path');

require('dotenv').config();

// ตั้งค่า View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routing
const homeRoutes = require('./routes/homeRoutes');
app.use('/', homeRoutes);

// เริ่ม server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
