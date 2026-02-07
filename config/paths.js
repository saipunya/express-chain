const path = require('path');

const uploadsRoot = path.join(process.cwd(), 'uploads');
module.exports = {
  uploadDownDir: path.join(uploadsRoot, 'down'),
  activityReportsDir: path.join(uploadsRoot, 'activity-reports'),
  fontsDir: path.join(process.cwd(), 'fonts'),
  watermarkFont: path.join(process.cwd(), 'fonts', 'THSarabunNew.ttf')
};
