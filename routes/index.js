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
    if (file === 'vongBusinessRoutes.js') baseRoute = '/vong-business';
    if (file === 'officialTravelRoutes.js') baseRoute = '/official-travel';
    if (file === 'vehicleRequestRoutes.js') baseRoute = '/vehicle-request';
    if (file === 'vehicleApprovalRoutes.js') baseRoute = '/vehicle-approval';
    if (file === 'driverTripRoutes.js') baseRoute = '/driver-trip';
    if (file === 'vehicleMasterRoutes.js') baseRoute = '/vehicle-master';
    if (file === 'driverMasterRoutes.js') baseRoute = '/driver-master';

    app.use(baseRoute, route);
  });
};
