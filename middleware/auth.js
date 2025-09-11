exports.requireLogin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    const nextUrl = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`/auth/login?next=${nextUrl}`);
  }
  next();
};

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      const nextUrl = encodeURIComponent(req.originalUrl || '/');
      return res.redirect(`/auth/login?next=${nextUrl}`);
    }
    if (!roles.includes(user.mClass)) {
      return res.status(403).render('errors/403', { user });
    }
    next();
  };
};

// Keep requireAdmin for convenience
// add mClass 'admin' and kjs to args
exports.requireAdmin = (...args) => exports.authorizeRoles('admin', 'kjs')(...args);

