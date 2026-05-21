// models/promotion/prizeModel.js
const db = require('../../config/db');

/**
 * Get available prizes for a given campaign (active and with remaining_qty > 0).
 * Ordered by weight desc then id.
 * @param {number|string} campaignId
 * @returns {Promise<Array>}
 */
async function getAvailablePrizesByCampaign(campaignId) {
  const [rows] = await db.query(
    `SELECT *
     FROM promotion_prizes
     WHERE campaign_id = ?
       AND active = 1
       AND (
  type = 'other'
  OR COALESCE(remaining_qty, 0) > 0
)
     ORDER BY weight DESC, id ASC`,
    [campaignId]
  );
  return rows;
}

/**
 * Lock a prize row by id (SELECT ... FOR UPDATE)
 */
async function lockPrizeById(connection, prizeId) {
  const [rows] = await connection.query('SELECT * FROM promotion_prizes WHERE id = ? FOR UPDATE', [prizeId]);
  return rows[0] || null;
}

/**
 * Reserve one unit of prize by moving it from remaining -> reserved.
 * Returns true if update succeeded (affectedRows > 0)
 */
async function reservePrizeById(connection, prizeId) {
  try {
    const [result] = await connection.query(`
  UPDATE promotion_prizes
  SET remaining_qty = remaining_qty - 1,
      reserved_qty = reserved_qty + 1,
      updated_at = NOW()
  WHERE id = ?
  AND COALESCE(remaining_qty, 0) > 0
`, [prizeId]);
    return (result && result.affectedRows && result.affectedRows > 0) || false;
  } catch (err) {
    // Treat check constraint violations as "out of stock" so the caller can retry another prize instead of 500-ing.
    if (err && (err.errno === 4025 || err.code === 'ER_CHECK_CONSTRAINT_VIOLATED')) return false;
    throw err;
  }
}

/**
 * Get prize list with campaign names
 */
async function getPrizesList(storeId = null) {
  const where = storeId ? 'WHERE p.store_id = ?' : '';
  const params = storeId ? [storeId] : [];
  const [rows] = await db.query(
    `SELECT p.*, c.name AS campaign_name,
            COALESCE(ds.pending_draws, 0) AS pending_draws,
            COALESCE(ds.claimed_draws, 0) AS claimed_draws,
            COALESCE(ds.declined_draws, 0) AS declined_draws
     FROM promotion_prizes p
     LEFT JOIN promotion_campaigns c ON p.campaign_id = c.id
     LEFT JOIN (
       SELECT prize_id,
              SUM(draw_status = 'drawn') AS pending_draws,
              SUM(draw_status = 'claimed') AS claimed_draws,
              SUM(draw_status = 'declined') AS declined_draws
       FROM promotion_draws
       WHERE prize_id IS NOT NULL
       GROUP BY prize_id
     ) ds ON ds.prize_id = p.id
     ${where}
     ORDER BY c.name ASC, p.name ASC`,
    params
  );
  return rows;
}

/**
 * Get active showcase prizes for one store (for play/kiosk welcome page)
 * - excludes type='other'
 * - includes active campaign in valid date range
 */
async function getShowcasePrizesByStore(storeId, limit = 6) {
  const safeLimit = Number.isInteger(Number(limit)) ? Math.max(1, Math.min(30, Number(limit))) : 6;
  const [rows] = await db.query(
    `SELECT p.*, c.name AS campaign_name
     FROM promotion_prizes p
     INNER JOIN promotion_campaigns c ON c.id = p.campaign_id
     WHERE p.store_id = ?
       AND p.active = 1
       AND p.type <> 'other'
       AND c.active = 1
       AND (c.start_at IS NULL OR c.start_at <= NOW())
       AND (c.end_at IS NULL OR c.end_at >= NOW())
       AND COALESCE(p.remaining_qty, 0) > 0
     ORDER BY p.weight ASC, p.id ASC
     LIMIT ?`,
    [storeId, safeLimit]
  );
  return rows;
}

async function getPrizeById(prizeId) {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS campaign_name
     FROM promotion_prizes p
     LEFT JOIN promotion_campaigns c ON p.campaign_id = c.id
     WHERE p.id = ?
     LIMIT 1`,
    [prizeId]
  );
  return rows[0] || null;
}

async function updatePrizeById(prizeId, payload) {
  await db.query(
    `UPDATE promotion_prizes
     SET prize_code = ?, name = ?, description = ?, type = ?, metadata = ?, initial_qty = ?, remaining_qty = ?, weight = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      payload.prize_code || null,
      payload.name,
      payload.description || null,
      payload.type,
      payload.metadata || null,
      payload.initial_qty,
      payload.remaining_qty,
      payload.weight,
      prizeId
    ]
  );
}

function toNonNegativeInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function getInventoryState(prize) {
  const initialQty = toNonNegativeInt(prize && prize.initial_qty);
  const remainingQty = toNonNegativeInt(prize && prize.remaining_qty);
  const reservedQty = toNonNegativeInt(prize && prize.reserved_qty);
  const consumedQty = Math.max(initialQty - remainingQty - reservedQty, 0);
  return {
    initialQty,
    remainingQty,
    reservedQty,
    consumedQty,
    minInitialQty: consumedQty + reservedQty
  };
}

async function updatePrizeWithStockById(prizeId, payload) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM promotion_prizes WHERE id = ? FOR UPDATE', [prizeId]);
    const prize = rows[0] || null;
    if (!prize) {
      await connection.rollback();
      return { ok: false, reason: 'not_found' };
    }

    const current = getInventoryState(prize);
    const nextInitialQty = Number.parseInt(payload.initial_qty, 10);
    if (!Number.isInteger(nextInitialQty) || nextInitialQty < current.minInitialQty) {
      await connection.rollback();
      return {
        ok: false,
        reason: 'stock_too_low',
        minInitialQty: current.minInitialQty,
        reservedQty: current.reservedQty,
        consumedQty: current.consumedQty
      };
    }

    const nextRemainingQty = Math.max(nextInitialQty - current.consumedQty - current.reservedQty, 0);

    await connection.query(
      `UPDATE promotion_prizes
       SET prize_code = ?, name = ?, description = ?, type = ?, metadata = ?, initial_qty = ?, remaining_qty = ?, weight = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        payload.prize_code || null,
        payload.name,
        payload.description || null,
        payload.type,
        payload.metadata || null,
        nextInitialQty,
        nextRemainingQty,
        payload.weight,
        prizeId
      ]
    );

    await connection.commit();
    return {
      ok: true,
      remainingQty: nextRemainingQty,
      reservedQty: current.reservedQty,
      consumedQty: current.consumedQty
    };
  } catch (err) {
    try { await connection.rollback(); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    try { connection.release(); } catch (e) { /* ignore */ }
  }
}

async function getPrizeDrawInventoryCounts(connection, prizeId) {
  const executor = connection && typeof connection.query === 'function' ? connection : db;
  const [rows] = await executor.query(
    `SELECT
       SUM(draw_status = 'drawn') AS pending_draws,
       SUM(draw_status = 'claimed') AS claimed_draws,
       SUM(draw_status = 'declined') AS declined_draws
     FROM promotion_draws
     WHERE prize_id = ?`,
    [prizeId]
  );
  const row = rows[0] || {};
  return {
    pendingDraws: toNonNegativeInt(row.pending_draws),
    claimedDraws: toNonNegativeInt(row.claimed_draws),
    declinedDraws: toNonNegativeInt(row.declined_draws)
  };
}

async function reconcilePrizeInventoryById(prizeId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM promotion_prizes WHERE id = ? FOR UPDATE', [prizeId]);
    const prize = rows[0] || null;
    if (!prize) {
      await connection.rollback();
      return { ok: false, reason: 'not_found' };
    }

    const counts = await getPrizeDrawInventoryCounts(connection, prizeId);
    const currentInitial = toNonNegativeInt(prize.initial_qty);
    const minInitialQty = counts.pendingDraws + counts.claimedDraws;
    const nextInitialQty = Math.max(currentInitial, minInitialQty);
    const nextReservedQty = counts.pendingDraws;
    const nextRemainingQty = Math.max(nextInitialQty - counts.claimedDraws - nextReservedQty, 0);

    await connection.query(
      `UPDATE promotion_prizes
       SET initial_qty = ?,
           remaining_qty = ?,
           reserved_qty = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [nextInitialQty, nextRemainingQty, nextReservedQty, prizeId]
    );

    await connection.commit();
    return {
      ok: true,
      before: {
        initialQty: currentInitial,
        remainingQty: toNonNegativeInt(prize.remaining_qty),
        reservedQty: toNonNegativeInt(prize.reserved_qty)
      },
      after: {
        initialQty: nextInitialQty,
        remainingQty: nextRemainingQty,
        reservedQty: nextReservedQty,
        usedQty: counts.claimedDraws
      },
      counts
    };
  } catch (err) {
    try { await connection.rollback(); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    try { connection.release(); } catch (e) { /* ignore */ }
  }
}

async function setPrizeActiveById(prizeId, active) {
  await db.query(
    'UPDATE promotion_prizes SET active = ?, updated_at = NOW() WHERE id = ?',
    [active ? 1 : 0, prizeId]
  );
}

async function countPrizeDrawReferences(prizeId) {
  const [rows] = await db.query(
    'SELECT COUNT(*) AS total FROM promotion_draws WHERE prize_id = ?',
    [prizeId]
  );
  return Number(rows[0] && rows[0].total) || 0;
}

async function deletePrizeById(prizeId) {
  const [result] = await db.query('DELETE FROM promotion_prizes WHERE id = ?', [prizeId]);
  return Boolean(result && result.affectedRows > 0);
}

/**
 * Create a new prize
 * - remaining_qty starts from initial_qty
 * - reserved_qty starts from 0
 */
async function createPrize(payload) {
  const [result] = await db.query(
    `INSERT INTO promotion_prizes
      (store_id, campaign_id, prize_code, name, description, type, metadata, initial_qty, remaining_qty, reserved_qty, weight, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW())`,
    [
      payload.store_id,
      payload.campaign_id,
      payload.prize_code || null,
      payload.name,
      payload.description || null,
      payload.type || 'other',
      payload.metadata || null,
      payload.initial_qty || 0,
      payload.initial_qty || 0,
      payload.weight || 1,
      payload.active ? 1 : 0
    ]
  );
  return result.insertId;
}

module.exports = {
  getAvailablePrizesByCampaign,
  getPrizesList,
  getShowcasePrizesByStore,
  getPrizeById,
  updatePrizeById,
  updatePrizeWithStockById,
  reconcilePrizeInventoryById,
  setPrizeActiveById,
  countPrizeDrawReferences,
  deletePrizeById,
  createPrize,
  lockPrizeById,
  reservePrizeById
};
