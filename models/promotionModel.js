// models/promotionModel.js
// Uses project's DB pool (mysql2/promise). Adjust import if your project uses a different path.
const db = require('../config/db');
const {
  getAvailablePrizesByCampaign,
  getPrizesList,
  getShowcasePrizesByStore,
  getPrizeById,
  updatePrizeById,
  setPrizeActiveById,
  countPrizeDrawReferences,
  deletePrizeById,
  createPrize,
  lockPrizeById,
  reservePrizeById
} = require('./promotion/prizeModel');
const {
  getCampaignById,
  getActiveCampaignByStore,
  getCampaignsWithStore,
  getCampaignByCodeInStore,
  createCampaign,
  updateCampaignById,
  setCampaignActiveById,
  getCampaignImpactCounts,
  deleteCampaignById
} = require('./promotion/campaignModel');
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

async function getStoreByCode(storeCode) {
  const [rows] = await db.query('SELECT * FROM stores WHERE store_code = ? LIMIT 1', [storeCode]);
  return rows[0] || null;
}

async function createStore(payload) {
  const [result] = await db.query(
    `INSERT INTO stores
      (store_code, name, description, timezone, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      payload.store_code,
      payload.name,
      payload.description || null,
      payload.timezone || 'UTC',
      payload.metadata || null
    ]
  );
  return result.insertId;
}

async function updateStoreById(storeId, payload) {
  await db.query(
    `UPDATE stores
     SET store_code = ?, name = ?, description = ?, timezone = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      payload.store_code,
      payload.name,
      payload.description || null,
      payload.timezone || 'UTC',
      storeId
    ]
  );
}

async function updateStoreMetadataById(storeId, metadata) {
  await db.query(
    'UPDATE stores SET metadata = ?, updated_at = NOW() WHERE id = ?',
    [metadata || null, storeId]
  );
}

async function getStoreImpactCounts(storeId) {
  const [rows] = await db.query(
    `SELECT
      (SELECT COUNT(*) FROM promotion_campaigns WHERE store_id = ?) AS campaigns,
      (SELECT COUNT(*) FROM promotion_prizes WHERE store_id = ?) AS prizes,
      (SELECT COUNT(*) FROM promotion_codes WHERE store_id = ?) AS codes,
      (SELECT COUNT(*) FROM promotion_draws WHERE store_id = ?) AS draws,
      (SELECT COUNT(*) FROM promotion_admin_users WHERE store_id = ? AND role = 'coop_admin') AS coop_admin_users`,
    [storeId, storeId, storeId, storeId, storeId]
  );
  return rows[0] || { campaigns: 0, prizes: 0, codes: 0, draws: 0, coop_admin_users: 0 };
}

async function getStoreDashboardSummaries(scope = null) {
  const scopedStoreId = getScopedStoreId(scope);
  const where = scopedStoreId ? 'WHERE s.id = ?' : '';
  const params = scopedStoreId ? [scopedStoreId] : [];
  const [rows] = await db.query(
    `SELECT
       s.id,
       s.name,
       s.store_code,
       COALESCE(campaign_stats.campaigns, 0) AS campaigns,
       COALESCE(prize_stats.prizes, 0) AS prizes,
       COALESCE(admin_stats.coop_admin_users, 0) AS coop_admin_users,
       COALESCE(code_stats.total, 0) AS total_codes,
       COALESCE(code_stats.unused, 0) AS unused_codes,
       COALESCE(code_stats.drawn, 0) AS drawn_codes,
       COALESCE(code_stats.claimed, 0) AS claimed_codes,
       COALESCE(code_stats.declined, 0) AS declined_codes,
       COALESCE(code_stats.expired, 0) AS expired_codes,
       COALESCE(draw_stats.total, 0) AS total_draws,
       COALESCE(draw_stats.drawn, 0) AS drawn_draws,
       COALESCE(draw_stats.claimed, 0) AS claimed_draws,
       COALESCE(draw_stats.declined, 0) AS declined_draws
     FROM stores s
     LEFT JOIN (
       SELECT store_id, COUNT(*) AS campaigns
       FROM promotion_campaigns
       GROUP BY store_id
     ) campaign_stats ON campaign_stats.store_id = s.id
     LEFT JOIN (
       SELECT store_id, COUNT(*) AS prizes
       FROM promotion_prizes
       GROUP BY store_id
     ) prize_stats ON prize_stats.store_id = s.id
     LEFT JOIN (
       SELECT store_id, COUNT(*) AS coop_admin_users
       FROM promotion_admin_users
       WHERE role = 'coop_admin'
       GROUP BY store_id
     ) admin_stats ON admin_stats.store_id = s.id
     LEFT JOIN (
       SELECT
         store_id,
         COUNT(*) AS total,
         SUM(status = 'unused') AS unused,
         SUM(status = 'drawn') AS drawn,
         SUM(status = 'claimed') AS claimed,
         SUM(status = 'declined') AS declined,
         SUM(status = 'expired') AS expired
       FROM promotion_codes
       GROUP BY store_id
     ) code_stats ON code_stats.store_id = s.id
     LEFT JOIN (
       SELECT
         store_id,
         COUNT(*) AS total,
         SUM(draw_status = 'drawn') AS drawn,
         SUM(draw_status = 'claimed') AS claimed,
         SUM(draw_status = 'declined') AS declined
       FROM promotion_draws
       GROUP BY store_id
     ) draw_stats ON draw_stats.store_id = s.id
     ${where}
     ORDER BY s.name ASC`,
    params
  );
  return rows;
}

async function deleteStoreById(storeId) {
  const [result] = await db.query('DELETE FROM stores WHERE id = ?', [storeId]);
  return Boolean(result && result.affectedRows > 0);
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

function getScopedStoreId(scope) {
  if (!scope) return null;
  if (scope.role === 'super_admin') return null;
  const storeId = Number(scope.store_id);
  return Number.isInteger(storeId) && storeId > 0 ? storeId : null;
}

 

 

module.exports = {
  getStoreById,
  getStoreByCode,
  createStore,
  updateStoreById,
  updateStoreMetadataById,
  getStoreImpactCounts,
  deleteStoreById,
  getStoreDashboardSummaries,
  getCampaignById,
  getActiveCampaignByStore,
  getCampaignByCodeInStore,
  createCampaign,
  updateCampaignById,
  setCampaignActiveById,
  getCampaignImpactCounts,
  deleteCampaignById,
  getCodeByValue,
  getCodeWithCampaign,
  getAvailablePrizesByCampaign,
  getDrawByToken,
  // Admin/read-only helpers
  getCodeCounts,
  getCodeSummary,
  getCampaignsWithStore,
  getStoresList,
  getPrizesList,
  getShowcasePrizesByStore,
  getPrizeById,
  updatePrizeById,
  setPrizeActiveById,
  countPrizeDrawReferences,
  deletePrizeById,
  createPrize,
  getCodesList,
  clearUnusedCodes,
  resetCodes,
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

 

function buildCodeFilters(scope = null, filters = {}) {
  const scopedStoreId = getScopedStoreId(scope);
  const selectedStoreId = scopedStoreId || (Number.isInteger(Number(filters.storeId)) && Number(filters.storeId) > 0 ? Number(filters.storeId) : null);
  const selectedCampaignId = Number.isInteger(Number(filters.campaignId)) && Number(filters.campaignId) > 0
    ? Number(filters.campaignId)
    : null;

  const where = [];
  const params = [];

  if (selectedStoreId) {
    where.push('store_id = ?');
    params.push(selectedStoreId);
  }

  if (selectedCampaignId) {
    where.push('campaign_id = ?');
    params.push(selectedCampaignId);
  }

  return {
    selectedStoreId,
    selectedCampaignId,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

/**
 * Get aggregate counts for promotion codes by status
 */
async function getCodeCounts(scope = null, filters = {}) {
  const { whereSql, params } = buildCodeFilters(scope, filters);
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'unused') AS unused,
       SUM(status = 'drawn') AS drawn,
       SUM(status = 'claimed') AS claimed,
       SUM(status = 'declined') AS declined,
       SUM(status = 'expired') AS expired
     FROM promotion_codes
     ${whereSql}`,
    params
  );
  const row = rows[0] || { total: 0, unused: 0, drawn: 0, claimed: 0, declined: 0, expired: 0 };
  return {
    ...row,
    used: Math.max(0, Number(row.total || 0) - Number(row.unused || 0))
  };
}

async function getCodeSummary(scope = null, filters = {}) {
  const { selectedStoreId, selectedCampaignId, whereSql, params } = buildCodeFilters(scope, filters);
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'unused') AS unused,
       SUM(status = 'drawn') AS drawn,
       SUM(status = 'claimed') AS claimed,
       SUM(status = 'declined') AS declined,
       SUM(status = 'expired') AS expired
     FROM promotion_codes
     ${whereSql}`,
    params
  );
  const row = rows[0] || { total: 0, unused: 0, drawn: 0, claimed: 0, declined: 0, expired: 0 };
  return {
    ...row,
    used: Math.max(0, Number(row.total || 0) - Number(row.unused || 0)),
    selectedStoreId,
    selectedCampaignId
  };
}

 

 

/**
 * Get codes list (read-only)
 */
async function getCodesList(limit = 500, scope = null, filters = {}) {
  const { whereSql, params } = buildCodeFilters(scope, filters);
  const includeExpired = Boolean(filters.includeExpired);
  const statusClause = includeExpired ? '' : (whereSql ? ' AND pc.status <> \'expired\'' : 'WHERE pc.status <> \'expired\'');
  const listParams = [...params, limit];
  const [rows] = await db.query(
     `SELECT pc.*, c.name AS campaign_name, s.name AS store_name, s.store_code
     FROM promotion_codes pc
     LEFT JOIN promotion_campaigns c ON pc.campaign_id = c.id
     LEFT JOIN stores s ON pc.store_id = s.id
     ${whereSql ? whereSql.replace(/store_id|campaign_id/g, 'pc.$&') : ''}${statusClause}
     ORDER BY pc.issued_at DESC
     LIMIT ?`,
    listParams
  );
  return rows;
}

async function clearUnusedCodes(scope = null, filters = {}) {
  const { whereSql, params } = buildCodeFilters(scope, filters);
  if (!params.length) {
    return 0;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id
       FROM promotion_codes
       ${whereSql ? `${whereSql} AND` : 'WHERE'} status IN ('unused', 'expired')
       FOR UPDATE`,
      params
    );

    const ids = Array.isArray(rows) ? rows.map(r => r.id).filter(Boolean) : [];
    if (!ids.length) {
      await connection.commit();
      return 0;
    }

    const placeholders = ids.map(() => '?').join(',');
    try {
      const [result] = await connection.query(
        `DELETE FROM promotion_codes WHERE id IN (${placeholders})`,
        ids
      );
      await connection.commit();
      return Number(result && result.affectedRows) || 0;
    } catch (deleteErr) {
      // Fallback to a soft clear if hard delete is blocked by schema constraints.
      await connection.rollback();
      await connection.beginTransaction();
      const [result] = await connection.query(
        `UPDATE promotion_codes
         SET status = 'expired', updated_at = NOW()
         WHERE id IN (${placeholders})`,
        ids
      );
      await connection.commit();
      return Number(result && result.affectedRows) || 0;
    }
  } catch (err) {
    try { await connection.rollback(); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    try { connection.release(); } catch (e) { /* ignore */ }
  }
}

async function resetCodes(scope = null, filters = {}) {
  const { whereSql, params } = buildCodeFilters(scope, filters);
  const codeWhereSql = whereSql ? whereSql.replace(/\b(store_id|campaign_id)\b/g, 'pc.$1') : '';

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let drawReferencesCleared = 0;
    let drawRowsDeleted = 0;

    // Release prize reservations for pending draws (draw_status='drawn') linked to codes
    // being reset — prevents stale reserved_qty from blocking future prize deletion.
    if (codeWhereSql) {
      await connection.query(
        `UPDATE promotion_prizes pp
         INNER JOIN promotion_draws d  ON d.prize_id = pp.id AND d.draw_status = 'drawn'
         INNER JOIN promotion_codes pc ON d.code_id   = pc.id
         SET pp.reserved_qty  = GREATEST(0, pp.reserved_qty - 1),
             pp.remaining_qty = pp.remaining_qty + 1,
             pp.updated_at    = NOW()
         ${codeWhereSql}`,
        params
      );
    }

    try {
      const [drawResult] = await connection.query(
        `UPDATE promotion_draws d
         INNER JOIN promotion_codes pc ON d.code_id = pc.id
         SET d.code_id = NULL, d.updated_at = NOW()
         ${codeWhereSql}`,
        params
      );
      drawReferencesCleared = Number(drawResult && drawResult.affectedRows) || 0;
    } catch (drawUpdateErr) {
      await connection.rollback();
      await connection.beginTransaction();

      // Re-release reservations after rollback (previous release was undone)
      if (codeWhereSql) {
        await connection.query(
          `UPDATE promotion_prizes pp
           INNER JOIN promotion_draws d  ON d.prize_id = pp.id AND d.draw_status = 'drawn'
           INNER JOIN promotion_codes pc ON d.code_id   = pc.id
           SET pp.reserved_qty  = GREATEST(0, pp.reserved_qty - 1),
               pp.remaining_qty = pp.remaining_qty + 1,
               pp.updated_at    = NOW()
           ${codeWhereSql}`,
          params
        );
      }

      const [drawDeleteResult] = await connection.query(
        `DELETE d
         FROM promotion_draws d
         INNER JOIN promotion_codes pc ON d.code_id = pc.id
         ${codeWhereSql}`,
        params
      );
      drawRowsDeleted = Number(drawDeleteResult && drawDeleteResult.affectedRows) || 0;
    }

    const [deleteResult] = await connection.query(
      `DELETE pc
       FROM promotion_codes pc
       ${codeWhereSql}`,
      params
    );

    await connection.commit();
    return {
      removed: Number(deleteResult && deleteResult.affectedRows) || 0,
      drawReferencesCleared,
      drawRowsDeleted
    };
  } catch (err) {
    try { await connection.rollback(); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    try { connection.release(); } catch (e) { /* ignore */ }
  }
}

/**
 * Get list of stores for admin selects
 */
async function getStoresList(scope = null) {
  const scopedStoreId = getScopedStoreId(scope);
  const where = scopedStoreId ? 'WHERE id = ?' : '';
  const params = scopedStoreId ? [scopedStoreId] : [];
  const [rows] = await db.query(
    `SELECT id, name, store_code, description, timezone, metadata FROM stores ${where} ORDER BY name ASC`,
    params
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
