// Simple admin auth stub for promotion admin pages.
// Replace with real authentication/authorization logic as needed.
module.exports = function promotionAdminAuth(req, res, next) {
  // If your app has a user object with admin flag, honor it.
  if (req.user && (req.user.is_admin || req.user.role === 'admin')) {
    res.locals.isPromotionAdmin = true;
    return next();
  }

  // Stub behavior: allow access but log a warning.
  // Change this to block access in production environments.
  console.warn('promotionAdminAuth: stub allowing access. Implement real admin check.');
  res.locals.isPromotionAdmin = true;
  return next();
};
