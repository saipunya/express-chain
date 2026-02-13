const fs = require('fs');
const path = require('path');

module.exports = (app) => {
  const routeFiles = fs.readdirSync(__dirname).filter(file => {
    return file.endsWith('Routes.js') && file !== 'index.js';
  });

  routeFiles.forEach(file => {
    const route = require(`./${file}`);

    // ตั้งชื่อ path base จากชื่อไฟล์ เช่น userRoutes.js → /users
    let baseRoute = '/' + file.replace('Routes.js', '').toLowerCase();

    // ถ้าเป็น homeRoutes.js ให้ใช้ '/' แทน
    if (file === 'homeRoutes.js') baseRoute = '/';
    if (file === 'activeCoopRoutes.js') baseRoute = '/activeCoop';

    app.use(baseRoute, route);
  });
};
