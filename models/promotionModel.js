// models/promotionModel.js
// Uses project's DB pool (mysql2/promise). Adjust import if your project uses a different path.
const db = require('../config/db');
const { getAvailablePrizesByCampaign, getPrizesList, lockPrizeById, reservePrizeById } = require('./promotion/prizeModel');
const { getCampaignById, getActiveCampaignByStore, getCampaignsWithStore } = require('./promotion/campaignModel');
const { getDrawByToken, createDrawRecord, lockDrawByToken, markDrawClaimed, markDrawDeclined, getDrawWithDetailsByToken, getDrawsList } = require('./promotion/drawModel');

/**
 * Get store by id
 * @param {number|string} storeId
 * @returns {Promise<Object|null>}
 */
async function getStoreById(storeId) {
  const [rows] = await db.query('SELECT * FROM stores WHERE id = ? LIMIT 1', [storeId]);
  return rows[0] || null;
}

 

/**
 * Get code record by exact code value
 * @param {string} code
 * @returns {Promise<Object|null>}
 */
async function getCodeByValue(code) {
  const [rows] = await db.query('SELECT * FROM promotion_codes WHERE code = ? LIMIT 1', [code]);
  return rows[0] || null;
}

/**
 * Get code together with its campaign information (joined)
 * Returns one object with code fields + selected campaign fields.
 * @param {string} code
 * @returns {Promise<Object|null>}
 */
async function getCodeWithCampaign(code) {
  const [rows] = await db.query(
    `SELECT pc.*,
            c.id AS campaign_id,
            c.campaign_code AS campaign_code,
            c.name AS campaign_name,
            c.store_id AS campaign_store_id,
            c.start_at AS campaign_start_at,
            c.end_at AS campaign_end_at
     FROM promotion_codes pc
     LEFT JOIN promotion_campaigns c ON pc.campaign_id = c.id
     WHERE pc.code = ?
     LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

 

 

module.exports = {
  getStoreById,
  getCampaignById,
  getActiveCampaignByStore,
  getCodeByValue,
  getCodeWithCampaign,
  getAvailablePrizesByCampaign,
  getDrawByToken,
  // Admin/read-only helpers
  getCodeCounts,
  getCampaignsWithStore,
  getStoresList,
  getPrizesList,
  getCodesList,
  getDrawsList,
  createCodesBatch,
  // Transactional helpers
  lockCodeByValue,
  lockPrizeById,
  reservePrizeById,
  markCodeStatus,
  createDrawRecord,
  getDrawWithDetailsByToken,
  lockDrawByToken,
  markDrawClaimed,
  markDrawDeclined,
  decrementReservedAndRemaining,
  decrementReservedOnly
};

/**
 * Lock a promotion code row by code value (SELECT ... FOR UPDATE)
 * connection: a mysql2 connection (from db.getConnection())
 */
async function lockCodeByValue(connection, code) {
  const [rows] = await connection.query('SELECT * FROM promotion_codes WHERE code = ? FOR UPDATE', [code]);
  return rows[0] || null;
}

 

 

/**
 * Update code status (within transaction connection)
 */
async function markCodeStatus(connection, codeId, status) {
  await connection.query('UPDATE promotion_codes SET status = ?, updated_at = NOW() WHERE id = ?', [status, codeId]);
}

 

/**
 * finalize a claim by consuming one reserved unit
 */
async function decrementReservedAndRemaining(connection, prizeId) {
  const [result] = await connection.query(
    'UPDATE promotion_prizes SET reserved_qty = reserved_qty - 1, updated_at = NOW() WHERE id = ? AND reserved_qty > 0',
    [prizeId]
  );
  return (result && result.affectedRows && result.affectedRows > 0) || false;
}

/**
 * release a reservation by moving one reserved unit back to remaining
 */
async function decrementReservedOnly(connection, prizeId) {
  const [result] = await connection.query(
    'UPDATE promotion_prizes SET reserved_qty = reserved_qty - 1, remaining_qty = remaining_qty + 1, updated_at = NOW() WHERE id = ? AND reserved_qty > 0',
    [prizeId]
  );
  return (result && result.affectedRows && result.affectedRows > 0) || false;
}

 

/**
 * Get aggregate counts for promotion codes by status
 */
async function getCodeCounts() {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'unused') AS unused,
       SUM(status = 'drawn') AS drawn,
       SUM(status = 'claimed') AS claimed,
       SUM(status = 'declined') AS declined,
       SUM(status = 'expired') AS expired
     FROM promotion_codes`
  );
  return rows[0] || { total: 0, unused: 0, drawn: 0, claimed: 0, declined: 0, expired: 0 };
}

 

 

/**
 * Get codes list (read-only)
 */
async function getCodesList(limit = 500) {
  const [rows] = await db.query(
    `SELECT pc.*, c.name AS campaign_name, s.name AS store_name, s.store_code
     FROM promotion_codes pc
     LEFT JOIN promotion_campaigns c ON pc.campaign_id = c.id
     LEFT JOIN stores s ON pc.store_id = s.id
     ORDER BY pc.issued_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

 

/**
 * Get list of stores for admin selects
 */
async function getStoresList() {
  const [rows] = await db.query(
    `SELECT id, name, store_code FROM stores ORDER BY name ASC`
  );
  return rows;
}

/**
 * Create a batch of unique promotion codes safely.
 * - Excludes confusing characters (O,0,I,1)
 * - Uses `INSERT IGNORE` with retry to handle rare race conditions
 * - Returns array of inserted rows: { id, code, issued_at, expires_at }
 */
async function createCodesBatch(storeId, campaignId, quantity) {
  const MAX_PER_GENERATE = 1000; // safety chunk
  const MAX_ATTEMPTS = 20;
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude O,0,I,1
  const codeLength = 8;

  function genCode() {
    let s = '';
    for (let i = 0; i < codeLength; i++) {
      s += charset[Math.floor(Math.random() * charset.length)];
    }
    return s;
  }

  function genUniqueCandidates(n) {
    const set = new Set();
    while (set.size < n) set.add(genCode());
    return Array.from(set);
  }

  const inserted = [];
  let attempts = 0;

  while (inserted.length < quantity && attempts < MAX_ATTEMPTS) {
    attempts++;
    const remaining = quantity - inserted.length;
    const genCount = Math.min(Math.max(remaining * 2, 50), MAX_PER_GENERATE);
    const candidates = genUniqueCandidates(genCount);

    // remove those already considered in `inserted`
    const candidateSet = new Set(candidates.filter(c => !inserted.find(x => x.code === c)));
    if (candidateSet.size === 0) continue;

    // check which candidates already exist in DB
    const candArr = Array.from(candidateSet);
    const placeholders = candArr.map(() => '?').join(',');
    const [existingRows] = await db.query(
      `SELECT code FROM promotion_codes WHERE code IN (${placeholders})`,
      candArr
    );
    const existingSet = new Set(existingRows.map(r => r.code));

    const newCand = candArr.filter(c => !existingSet.has(c));
    if (newCand.length === 0) continue;

    // limit to remaining
    const toInsert = newCand.slice(0, remaining);

    // Build batch INSERT IGNORE
    const rowPlaceholders = toInsert.map(() => '(?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, NOW(), NOW())').join(',');
    const sql = `INSERT IGNORE INTO promotion_codes (code, store_id, campaign_id, issued_at, expires_at, status, created_at, updated_at) VALUES ${rowPlaceholders}`;
    const params = [];
    for (const code of toInsert) {
      params.push(code, storeId || null, campaignId || null, 'unused');
    }

    const [result] = await db.query(sql, params);

    // fetch which of the tried codes now exist (either inserted now or inserted concurrently)
    const [fetched] = await db.query(
      `SELECT id, code, issued_at, expires_at FROM promotion_codes WHERE code IN (${toInsert.map(() => '?').join(',')})`,
      toInsert
    );

    for (const row of fetched) {
      if (!inserted.find(x => x.code === row.code)) {
        inserted.push(row);
        if (inserted.length >= quantity) break;
      }
    }
  }

  if (inserted.length < quantity) {
    // partial success: return what we have
    return inserted;
  }

  return inserted.slice(0, quantity);
}
