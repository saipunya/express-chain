const AuditLog = require('../models/auditLogModel');

const toInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

exports.index = async (req, res) => {
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(200, Math.max(10, toInt(req.query.limit, 50)));
  const offset = (page - 1) * limit;

  const filters = {
    from: req.query.from || null,
    to: req.query.to || null,
    username: req.query.username || null,
    module: req.query.module || null,
    action: req.query.action || null,
    proCode: req.query.proCode || null,
    entityType: req.query.entityType || null,
    entityId: req.query.entityId || null,
    method: req.query.method || null,
    statusCode: req.query.statusCode || null,
    q: req.query.q || null,
    limit,
    offset
  };

  const [rows, total] = await Promise.all([
    AuditLog.findMany(filters),
    AuditLog.count(filters)
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.render('auditLog/index', {
    title: 'Audit Log',
    user: req.session.user,
    rows,
    total,
    page,
    totalPages,
    limit,
    filters
  });
};

exports.show = async (req, res) => {
  const id = toInt(req.params.id, null);
  if (!id) {
    return res.status(400).send('Invalid id');
  }

  const row = await AuditLog.findById(id);
  if (!row) {
    return res.status(404).send('Not found');
  }

  res.render('auditLog/show', {
    title: `Audit Log #${id}`,
    user: req.session.user,
    row
  });
};
