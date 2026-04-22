const db = require('../../config/db');

async function listUsersWithStore() {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.display_name, u.role, u.store_id, u.is_active,
            u.last_login_at, u.created_at, u.updated_at,
            s.name AS store_name, s.store_code
     FROM promotion_admin_users u
     LEFT JOIN stores s ON s.id = u.store_id
     ORDER BY FIELD(u.role, 'super_admin', 'coop_admin'), u.username ASC`
  );
  return rows;
}

async function getByUsername(username) {
  const [rows] = await db.query(
    `SELECT id, username, password_hash, display_name, role, store_id, is_active
     FROM promotion_admin_users
     WHERE username = ?
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function getById(id) {
  const [rows] = await db.query(
    `SELECT id, username, password_hash, display_name, role, store_id, is_active
     FROM promotion_admin_users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createUser({ username, passwordHash, displayName, role, storeId, isActive }) {
  const [result] = await db.query(
    `INSERT INTO promotion_admin_users
      (username, password_hash, display_name, role, store_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      username,
      passwordHash,
      displayName || null,
      role,
      storeId || null,
      Number(isActive) ? 1 : 0
    ]
  );
  return result.insertId;
}

async function updateUserProfile(id, { displayName, role, storeId }) {
  await db.query(
    `UPDATE promotion_admin_users
     SET display_name = ?, role = ?, store_id = ?, updated_at = NOW()
     WHERE id = ?`,
    [displayName || null, role, storeId || null, id]
  );
}

async function updateStatus(id, isActive) {
  await db.query(
    'UPDATE promotion_admin_users SET is_active = ?, updated_at = NOW() WHERE id = ?',
    [Number(isActive) ? 1 : 0, id]
  );
}

async function updatePasswordHash(id, passwordHash) {
  const [result] = await db.query(
    'UPDATE promotion_admin_users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [passwordHash, id]
  );
  return Number(result && result.affectedRows) || 0;
}

async function touchLastLogin(id) {
  await db.query(
    'UPDATE promotion_admin_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?',
    [id]
  );
}

module.exports = {
  listUsersWithStore,
  getByUsername,
  getById,
  createUser,
  updateUserProfile,
  updateStatus,
  updatePasswordHash,
  touchLastLogin
};
