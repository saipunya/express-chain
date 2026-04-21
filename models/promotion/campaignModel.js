// models/promotion/campaignModel.js
const db = require('../../config/db');

/**
 * Get campaign by id
 * @param {number|string} campaignId
 * @returns {Promise<Object|null>}
 */
async function getCampaignById(campaignId) {
  const [rows] = await db.query('SELECT * FROM promotion_campaigns WHERE id = ? LIMIT 1', [campaignId]);
  return rows[0] || null;
}

/**
 * Get active campaigns for a store.
 * Returns array of campaigns that are active and within start/end bounds.
 * @param {number|string} storeId
 * @returns {Promise<Array>}
 */
async function getActiveCampaignByStore(storeId) {
  const [rows] = await db.query(
    `SELECT *
     FROM promotion_campaigns
     WHERE store_id = ?
       AND active = 1
       AND (start_at IS NULL OR start_at <= NOW())
       AND (end_at IS NULL OR end_at >= NOW())
     ORDER BY start_at DESC, id ASC`,
    [storeId]
  );
  return rows;
}

/**
 * Get campaigns with store info
 */
async function getCampaignsWithStore() {
  const [rows] = await db.query(
    `SELECT c.*, s.id AS store_id, s.name AS store_name, s.store_code
     FROM promotion_campaigns c
     LEFT JOIN stores s ON c.store_id = s.id
     ORDER BY s.name ASC, c.start_at DESC`);
  return rows;
}

module.exports = {
  getCampaignById,
  getActiveCampaignByStore,
  getCampaignsWithStore
};
