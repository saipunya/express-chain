const AuditLog = require('../models/auditLogModel');

const MAX_TEXT = 4000;
const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'm_pass',
  'token',
  'access_token',
  'refresh_token',
  'authorization'
]);

const safeJsonStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const truncate = (text, maxLen = MAX_TEXT) => {
  if (typeof text !== 'string') return null;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
};

const redact = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
};

const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || null;
};

const isStaticPath = (path) => {
  return (
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/images/') ||
    path.startsWith('/icon/') ||
    path.startsWith('/uploads/') ||
    path.startsWith('/fonts/') ||
    path === '/favicon.ico'
  );
};

const detectModule = (reqPath) => {
  const first = (reqPath.split('/')[1] || '').toLowerCase();
  return first || 'root';
};

const pickFirst = (...values) => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
};

const toIntOrNull = (value) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
};

const extractEntity = (req, moduleName) => {
  const paramsId = pickFirst(req.params?.id);
  const proCode = pickFirst(req.body?.pro_code, req.query?.pro_code, req.body?.kp_procode, req.query?.pro_code);

  if (moduleName === 'planactivity') {
    if (paramsId) {
      return { entity_type: 'activity', entity_id: paramsId, pro_code: proCode, ac_id: toIntOrNull(paramsId), kp_id: null };
    }
    if (proCode) {
      return { entity_type: 'project', entity_id: proCode, pro_code: proCode, ac_id: null, kp_id: null };
    }
  }

  if (moduleName === 'planproject') {
    if (paramsId) {
      return { entity_type: 'project', entity_id: paramsId, pro_code: proCode, ac_id: null, kp_id: null };
    }
    if (proCode) {
      return { entity_type: 'project', entity_id: proCode, pro_code: proCode, ac_id: null, kp_id: null };
    }
  }

  if (moduleName.toLowerCase() === 'plankpi') {
    if (paramsId) {
      return { entity_type: 'kpi', entity_id: paramsId, pro_code: proCode, ac_id: null, kp_id: toIntOrNull(paramsId) };
    }
    if (proCode) {
      return { entity_type: 'project', entity_id: proCode, pro_code: proCode, ac_id: null, kp_id: null };
    }
  }

  if (proCode) {
    return { entity_type: 'project', entity_id: proCode, pro_code: proCode, ac_id: null, kp_id: null };
  }

  return { entity_type: null, entity_id: null, pro_code: null, ac_id: null, kp_id: null };
};

const detectAction = (req) => {
  const p = (req.path || '').toLowerCase();
  const m = (req.method || 'GET').toUpperCase();

  if (m === 'GET') return 'VIEW';
  if (p.includes('/delete') || p.endsWith('/destroy')) return 'DELETE';
  if (p.includes('/update') || p.includes('/edit')) return 'UPDATE';
  if (p.includes('/store') || p.includes('/create') || p.includes('/add')) return 'CREATE';
  if (p.includes('/report')) return 'REPORT_SAVE';
  return 'MUTATE';
};

const shouldLog = (req) => {
  if (!req.session || !req.session.user) return false;
  if (isStaticPath(req.path || '')) return false;

  const path = req.path || '';
  if (path.startsWith('/auth')) return false;

  // Focus on management modules
  const isPlanModule =
    path.startsWith('/plan') ||
    path.startsWith('/planactivity') ||
    path.startsWith('/planproject') ||
    path.toLowerCase().startsWith('/plankpi');

  if (!isPlanModule) return false;

  // Log all mutations; for GET log only key management pages.
  if ((req.method || '').toUpperCase() !== 'GET') return true;

  return (
    path.includes('/report') ||
    path.includes('/create') ||
    path.includes('/edit') ||
    path.includes('/select') ||
    path.includes('/activities-overview')
  );
};

module.exports = () => {
  return (req, res, next) => {
    if (!shouldLog(req)) {
      return next();
    }

    const startedAt = Date.now();

    res.on('finish', async () => {
      try {
        const durationMs = Date.now() - startedAt;
        const user = req.session?.user || {};

        const moduleName = detectModule(req.path || '');
        const entity = extractEntity(req, moduleName);

        // Skip large/multipart bodies
        const isMultipart = typeof req.headers['content-type'] === 'string' && req.headers['content-type'].includes('multipart/form-data');
        const bodyObj = isMultipart ? { _multipart: true } : redact(req.body || {});

        const entry = {
          user_id: user.id ?? null,
          username: user.username || user.m_user || null,
          fullname: user.fullname || user.m_name || null,
          m_class: user.mClass || user.m_class || null,
          session_id: req.sessionID || null,

          entity_type: entity.entity_type,
          entity_id: entity.entity_id,
          pro_code: entity.pro_code,
          ac_id: entity.ac_id,
          kp_id: entity.kp_id,

          module: moduleName,
          action: detectAction(req),

          method: (req.method || 'GET').toUpperCase(),
          path: req.originalUrl || req.path || '',

          status_code: res.statusCode,
          duration_ms: durationMs,

          ip: getClientIp(req),
          user_agent: req.get('user-agent') || null,

          query_text: truncate(safeJsonStringify(req.query || {})),
          body_text: truncate(safeJsonStringify(bodyObj)),
          error_text: null
        };

        await AuditLog.create(entry);
      } catch (err) {
        // Never break the request if audit logging fails
        console.warn('[auditLog] insert failed:', err.message);
      }
    });

    next();
  };
};
