const db = require('../config/db');

const truncate = (value, maxLen) => {
  if (typeof value !== 'string') return null;
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 3) + '...';
};

module.exports = {
  async create(entry) {
    const {
      user_id,
      username,
      fullname,
      m_class,
      session_id,

      entity_type,
      entity_id,
      pro_code,
      ac_id,
      kp_id,
      module,
      action,
      method,
      path,
      status_code,
      duration_ms,
      ip,
      user_agent,
      query_text,
      body_text,
      error_text
    } = entry;

    const [result] = await db.query(
      `INSERT INTO audit_log
        (user_id, username, fullname, m_class, session_id,
         entity_type, entity_id, pro_code, ac_id, kp_id,
         module, action, method, path,
         status_code, duration_ms, ip, user_agent,
         query_text, body_text, error_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id ?? null,
        username ?? null,
        fullname ?? null,
        m_class ?? null,
        session_id ?? null,

        entity_type ?? null,
        entity_id ?? null,
        pro_code ?? null,
        ac_id ?? null,
        kp_id ?? null,

        module,
        action,
        method,
        path,
        status_code ?? null,
        duration_ms ?? null,
        ip ?? null,
        truncate(user_agent ?? null, 255),
        query_text ?? null,
        body_text ?? null,
        error_text ?? null
      ]
    );

    return result.insertId;
  },

  async findMany({
    from,
    to,
    username,
    module,
    action,
    proCode,
    entityType,
    entityId,
    method,
    statusCode,
    q,
    limit = 50,
    offset = 0
  }) {
    const where = [];
    const params = [];

    if (from) {
      where.push('created_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(to);
    }
    if (username) {
      where.push('username = ?');
      params.push(username);
    }
    if (module) {
      where.push('module = ?');
      params.push(module);
    }
    if (action) {
      where.push('action = ?');
      params.push(action);
    }
    if (proCode) {
      where.push('pro_code = ?');
      params.push(proCode);
    }
    if (entityType) {
      where.push('entity_type = ?');
      params.push(entityType);
    }
    if (entityId) {
      where.push('entity_id = ?');
      params.push(entityId);
    }
    if (method) {
      where.push('method = ?');
      params.push(method);
    }
    if (statusCode) {
      where.push('status_code = ?');
      params.push(Number(statusCode));
    }
    if (q) {
      where.push('(path LIKE ? OR query_text LIKE ? OR body_text LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT id, created_at, username, fullname, m_class, entity_type, entity_id, pro_code, ac_id, kp_id,
              module, action, method, path,
              status_code, duration_ms, ip, user_agent
       FROM audit_log
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return rows;
  },

  async count({ from, to, username, module, action, proCode, entityType, entityId, method, statusCode, q }) {
    const where = [];
    const params = [];

    if (from) {
      where.push('created_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(to);
    }
    if (username) {
      where.push('username = ?');
      params.push(username);
    }
    if (module) {
      where.push('module = ?');
      params.push(module);
    }
    if (action) {
      where.push('action = ?');
      params.push(action);
    }
    if (proCode) {
      where.push('pro_code = ?');
      params.push(proCode);
    }
    if (entityType) {
      where.push('entity_type = ?');
      params.push(entityType);
    }
    if (entityId) {
      where.push('entity_id = ?');
      params.push(entityId);
    }
    if (method) {
      where.push('method = ?');
      params.push(method);
    }
    if (statusCode) {
      where.push('status_code = ?');
      params.push(Number(statusCode));
    }
    if (q) {
      where.push('(path LIKE ? OR query_text LIKE ? OR body_text LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_log ${whereSql}`,
      params
    );

    return Number(row.total || 0);
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM audit_log WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }
};
