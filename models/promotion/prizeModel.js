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
async function getPrizesList() {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS campaign_name
     FROM promotion_prizes p
     LEFT JOIN promotion_campaigns c ON p.campaign_id = c.id
     ORDER BY c.name ASC, p.name ASC`);
  return rows;
}

module.exports = {
  getAvailablePrizesByCampaign,
  getPrizesList,
  lockPrizeById,
  reservePrizeById
};
