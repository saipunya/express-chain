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
async function getCampaignsWithStore(storeId = null) {
  const where = storeId ? 'WHERE c.store_id = ?' : '';
  const params = storeId ? [storeId] : [];
  const [rows] = await db.query(
    `SELECT c.*, s.id AS store_id, s.name AS store_name, s.store_code
     FROM promotion_campaigns c
     LEFT JOIN stores s ON c.store_id = s.id
     ${where}
     ORDER BY s.name ASC, c.start_at DESC`,
    params
  );
  return rows;
}

async function getCampaignByCodeInStore(storeId, campaignCode) {
  const [rows] = await db.query(
    `SELECT *
     FROM promotion_campaigns
     WHERE store_id = ?
       AND campaign_code = ?
     LIMIT 1`,
    [storeId, campaignCode]
  );
  return rows[0] || null;
}

async function createCampaign(payload) {
  const [result] = await db.query(
    `INSERT INTO promotion_campaigns
      (store_id, campaign_code, name, description, start_at, end_at, active, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      payload.store_id,
      payload.campaign_code,
      payload.name,
      payload.description || null,
      payload.start_at || null,
      payload.end_at || null,
      payload.active ? 1 : 0,
      payload.metadata || null
    ]
  );
  return result.insertId;
}

async function updateCampaignById(campaignId, payload) {
  await db.query(
    `UPDATE promotion_campaigns
     SET campaign_code = ?,
         name = ?,
         description = ?,
         start_at = ?,
         end_at = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      payload.campaign_code,
      payload.name,
      payload.description || null,
      payload.start_at || null,
      payload.end_at || null,
      campaignId
    ]
  );
}

async function setCampaignActiveById(campaignId, active) {
  await db.query(
    `UPDATE promotion_campaigns
     SET active = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [active ? 1 : 0, campaignId]
  );
}

async function getCampaignImpactCounts(campaignId) {
  const [rows] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM promotion_codes WHERE campaign_id = ?) AS codes,
       (SELECT COUNT(*) FROM promotion_prizes WHERE campaign_id = ?) AS prizes,
       (SELECT COUNT(*) FROM promotion_draws WHERE campaign_id = ?) AS draws`,
    [campaignId, campaignId, campaignId]
  );
  return rows[0] || { codes: 0, prizes: 0, draws: 0 };
}

async function deleteCampaignById(campaignId) {
  const [result] = await db.query('DELETE FROM promotion_campaigns WHERE id = ?', [campaignId]);
  return Boolean(result && result.affectedRows > 0);
}

module.exports = {
  getCampaignById,
  getActiveCampaignByStore,
  getCampaignsWithStore,
  getCampaignByCodeInStore,
  createCampaign,
  updateCampaignById,
  setCampaignActiveById,
  getCampaignImpactCounts,
  deleteCampaignById
};
