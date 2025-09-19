// ...existing code...

exports.isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.mClass === 'admin') {
    return next();
  }
  res.render('error_page', { message: 'ไม่มีสิทธิ์เข้าใช้งานหน้านี้' });
};
