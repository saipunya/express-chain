const path = require('path');

module.exports = {
  uploadDownDir: path.join(process.cwd(), 'uploads', 'down'),
  fontsDir: path.join(process.cwd(), 'fonts'),
  watermarkFont: path.join(process.cwd(), 'fonts', 'THSarabunNew.ttf')
};
