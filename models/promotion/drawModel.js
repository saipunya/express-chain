// models/promotion/drawModel.js
const db = require('../../config/db');

function getExecutor(connection) {
  return connection && typeof connection.query === 'function' ? connection : db;
}

/**
 * Insert a draw record.
 * If `connection` (mysql2 connection) is provided, runs on that connection
 * to support transactions; otherwise uses the shared `db` pool.
 * @param {object|null} connection
 * @param {object} payload
 * @returns {Promise<number>} insertId
 */
async function insertDraw(connection, payload) {
  const sql = `INSERT INTO promotion_draws
    (draw_token, store_id, campaign_id, code_id, prize_id, draw_status, customer_name, customer_phone, drawn_at, device_type, device_ip, user_agent, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, NOW(), NOW())`;
  const params = [
    payload.draw_token,
    payload.store_id || null,
    payload.campaign_id || null,
    payload.code_id || null,
    payload.prize_id || null,
    payload.draw_status || 'drawn',
    payload.customer_name || null,
    payload.customer_phone || null,
    payload.device_type || null,
    payload.device_ip || null,
    payload.user_agent || null,
    payload.metadata || null
  ];

  const [result] = await getExecutor(connection).query(sql, params);
  return result.insertId;
}

async function createDrawRecord(connection, payload) {
  return insertDraw(connection, payload);
}

async function getDrawByToken(token) {
  const [rows] = await db.query(
    'SELECT * FROM promotion_draws WHERE draw_token = ? LIMIT 1',
    [token]
  );
  return rows[0] || null;
}

async function lockDrawByToken(connection, token) {
  const [rows] = await connection.query(
    'SELECT * FROM promotion_draws WHERE draw_token = ? LIMIT 1 FOR UPDATE',
    [token]
  );
  return rows[0] || null;
}

async function markDrawClaimed(connection, drawId, customerName, customerPhone) {
  const [result] = await connection.query(
    `UPDATE promotion_draws
     SET draw_status = 'claimed',
         customer_name = ?,
         customer_phone = ?,
         claimed_at = NOW(),
         updated_at = NOW()
     WHERE id = ?
       AND draw_status = 'drawn'`,
    [customerName || null, customerPhone || null, drawId]
  );
  return (result && result.affectedRows && result.affectedRows > 0) || false;
}

async function markDrawDeclined(connection, drawId) {
  const [result] = await connection.query(
    `UPDATE promotion_draws
     SET draw_status = 'declined',
         declined_at = NOW(),
         updated_at = NOW()
     WHERE id = ?
       AND draw_status = 'drawn'`,
    [drawId]
  );
  return (result && result.affectedRows && result.affectedRows > 0) || false;
}

async function getDrawWithDetailsByToken(token) {
  const [rows] = await db.query(
    `SELECT d.*,
            pc.code AS code_value,
            pr.name AS prize_name,
            pr.description AS prize_description,
            pr.type AS prize_type,
            c.name AS campaign_name,
            s.name AS store_name,
            s.store_code
     FROM promotion_draws d
     LEFT JOIN promotion_codes pc ON d.code_id = pc.id
     LEFT JOIN promotion_prizes pr ON d.prize_id = pr.id
     LEFT JOIN promotion_campaigns c ON d.campaign_id = c.id
     LEFT JOIN stores s ON d.store_id = s.id
     WHERE d.draw_token = ?
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function getDrawsList(limit = 500, storeId = null) {
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 500;
  const where = storeId ? 'WHERE d.store_id = ?' : '';
  const params = storeId ? [storeId, safeLimit] : [safeLimit];
  const [rows] = await db.query(
    `SELECT d.*,
            pc.code AS code_value,
            pr.name AS prize_name,
            c.name AS campaign_name,
            s.name AS store_name,
            s.store_code
     FROM promotion_draws d
     LEFT JOIN promotion_codes pc ON d.code_id = pc.id
     LEFT JOIN promotion_prizes pr ON d.prize_id = pr.id
     LEFT JOIN promotion_campaigns c ON d.campaign_id = c.id
     LEFT JOIN stores s ON d.store_id = s.id
     ${where}
     ORDER BY d.drawn_at DESC, d.id DESC
     LIMIT ?`,
    params
  );
  return rows;
}

/**
 * Get draws for a user (by customer phone).
 * Uses the pool `db` and returns an array of draw rows with related info.
 * @param {string} customerPhone
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
async function getDrawByUser(customerPhone, limit = 100) {
  const [rows] = await db.query(
    `SELECT d.*, pc.code AS code_value, pr.name AS prize_name, c.name AS campaign_name, s.name AS store_name, s.store_code
     FROM promotion_draws d
     LEFT JOIN promotion_codes pc ON d.code_id = pc.id
     LEFT JOIN promotion_prizes pr ON d.prize_id = pr.id
     LEFT JOIN promotion_campaigns c ON d.campaign_id = c.id
     LEFT JOIN stores s ON d.store_id = s.id
     WHERE d.customer_phone = ?
     ORDER BY d.drawn_at DESC
     LIMIT ?`,
    [customerPhone, limit]
  );
  return rows;
}

module.exports = {
  insertDraw,
  createDrawRecord,
  getDrawByToken,
  lockDrawByToken,
  markDrawClaimed,
  markDrawDeclined,
  getDrawWithDetailsByToken,
  getDrawsList,
  getDrawByUser
};
