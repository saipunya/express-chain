function isAdmin(user) {
	if (!user) return false;
	// Accept either explicit role or your existing m_class value
	return user.role === 'admin' || user.m_class === 'admin';
}

function requireAdmin(req, res, next) {
	const user = req.user || (req.session && req.session.user) || (res.locals && res.locals.user);
	if (isAdmin(user)) return next();

	// Use Express accepts() for better HTML detection
	const wantsHtml = typeof req.accepts === 'function' ? !!req.accepts('html') : String(req.headers.accept || '').includes('text/html');

	// Authenticated but not admin => redirect to dashboard for HTML, 403 for API
	if (user) {
		if (wantsHtml) return res.redirect('/dashboard');
		return res.status(403).json({ error: 'Forbidden: admin only' });
	}

	// Guest => redirect to login for HTML, 401 for API
	if (wantsHtml) return res.redirect('/auth/login');
	return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAdmin };
