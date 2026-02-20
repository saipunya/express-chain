function isMulterLikeError(err) {
  if (!err) return false;
  // multer มักมี code เช่น LIMIT_FILE_SIZE
  if (typeof err.code === 'string' && err.code.startsWith('LIMIT_')) return true;
  // บางกรณี thrown จาก storage/filter
  if (err.name === 'MulterError') return true;
  return false;
}

function toThaiMessage(err) {
  if (!err) return 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์';
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'ไฟล์มีขนาดใหญ่เกินกำหนด';
    case 'LIMIT_FILE_COUNT':
      return 'จำนวนไฟล์เกินกำหนด';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'ฟิลด์ไฟล์ไม่ถูกต้อง';
    default:
      return err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์';
  }
}

// usage:
// app.post('/down', upload.single('down_file'), downUploadErrorMiddleware('down/create'), downController.create)
module.exports = function downUploadErrorMiddleware(viewName, getRenderData) {
  return function (err, req, res, next) {
    if (!err) return next();

    // จัดการเฉพาะ error ที่น่าจะมาจาก upload เท่านั้น
    if (!isMulterLikeError(err)) return next(err);

    const error = toThaiMessage(err);
    const base = typeof getRenderData === 'function' ? (getRenderData(req) || {}) : {};
    return res.status(400).render(viewName, {
      ...base,
      user: req.session && req.session.user,
      error
    });
  };
};
