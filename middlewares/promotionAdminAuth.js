function buildPromotionAdminFromMainSession(req) {
  const user = req.session && req.session.user;
  if (!user || user.mClass !== 'admin') return null;

  return {
    id: user.id || user.m_id || null,
    username: user.username || user.m_user || 'main-admin',
    display_name: user.fullname || user.m_name || 'Main Admin',
    role: 'super_admin',
    store_id: null,
    source: 'main_session'
  };
}

module.exports = function promotionAdminAuth(req, res, next) {
  const promotionAdmin = req.session && req.session.promotionAdmin;
  const fallbackMainAdmin = buildPromotionAdminFromMainSession(req);
  const resolved = promotionAdmin || fallbackMainAdmin;

  if (!resolved) {
    if ((req.get('accept') || '').includes('application/json')) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }
    if (req.session) req.session.promotionAdminReturnTo = req.originalUrl;
    return res.redirect('/promotion/admin/login');
  }

  req.promotionAdmin = {
    id: resolved.id || null,
    username: resolved.username,
    display_name: resolved.display_name,
    role: resolved.role,
    store_id: resolved.store_id || null,
    source: resolved.source || 'promotion_session'
  };

  res.locals.isPromotionAdmin = true;
  res.locals.promotionAdmin = req.promotionAdmin;
  return next();
};
