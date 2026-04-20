// middlewares/flash.js
// Minimal flash message middleware scoped to routes that use it.
// Stores a single flash message in session under `req.session.flash`.
module.exports = function flashMiddleware() {
  return (req, res, next) => {
    // expose and consume flash for views
    if (req.session && req.session.flash) {
      res.locals.flash = req.session.flash;
      // remove so it doesn't persist
      delete req.session.flash;
    } else {
      res.locals.flash = null;
    }

    // helper to set flash for next request (useful before redirect)
    req.flash = (type, msg) => {
      if (!req.session) return;
      req.session.flash = { type: type || 'info', message: msg };
    };

    next();
  };
};
