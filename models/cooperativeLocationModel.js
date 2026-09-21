const db = require('../config/db');

function createStore(pool = db) {
  let schemaPromise;
  function ensureSchema() {
    if (!schemaPromise) {
      schemaPromise = pool.query(`CREATE TABLE IF NOT EXISTS cooperative_locations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        c_code VARCHAR(50) NOT NULL,
        district VARCHAR(100) NULL,
        address_text VARCHAR(500) NULL,
        latitude DECIMAL(10,7) NOT NULL,
        longitude DECIMAL(10,7) NOT NULL,
        google_maps_url VARCHAR(2048) NULL,
        website_url VARCHAR(2048) NULL,
        is_verified TINYINT(1) NOT NULL DEFAULT 0,
        is_public TINYINT(1) NOT NULL DEFAULT 0,
        verified_at DATETIME NULL,
        updated_by VARCHAR(150) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cooperative_locations_code (c_code),
        KEY idx_cooperative_locations_public (is_public, is_verified)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch((error) => {
        schemaPromise = null;
        throw error;
      });
    }
    return schemaPromise;
  }

  async function list(search = '') {
    await ensureSchema();
    const keyword = String(search || '').trim();
    const where = keyword ? 'WHERE cl.c_code LIKE ? OR ac.c_name LIKE ? OR cl.district LIKE ?' : '';
    const params = keyword ? Array(3).fill(`%${keyword}%`) : [];
    const [rows] = await pool.query(`
      SELECT cl.*, ac.c_name, ac.coop_group, ac.in_out_group, ac.c_status
      FROM cooperative_locations cl
      LEFT JOIN active_coop ac ON ac.c_code = cl.c_code
      ${where}
      ORDER BY ac.c_name ASC, cl.c_code ASC
    `, params);
    return rows;
  }

  async function getById(id) {
    await ensureSchema();
    const [rows] = await pool.query(`
      SELECT cl.*, ac.c_name, ac.coop_group, ac.in_out_group, ac.c_status
      FROM cooperative_locations cl
      LEFT JOIN active_coop ac ON ac.c_code = cl.c_code
      WHERE cl.id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
  }

  async function getByCode(code) {
    await ensureSchema();
    const [rows] = await pool.query('SELECT * FROM cooperative_locations WHERE c_code = ? LIMIT 1', [code]);
    return rows[0] || null;
  }

  async function listInstitutions() {
    const [rows] = await pool.query(`
      SELECT c_code, c_name, coop_group, in_out_group, c_group
      FROM active_coop
      WHERE c_status = 'ดำเนินการ' AND c_code IS NOT NULL AND c_code <> ''
      ORDER BY c_name ASC
    `);
    return rows;
  }

  async function create(values, updatedBy) {
    await ensureSchema();
    const [result] = await pool.query(`
      INSERT INTO cooperative_locations
        (c_code, district, address_text, latitude, longitude, google_maps_url, website_url,
         is_verified, is_public, verified_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      values.c_code, values.district || null, values.address_text || null,
      values.latitude, values.longitude, values.google_maps_url || null, values.website_url || null,
      values.is_verified ? 1 : 0, values.is_public ? 1 : 0,
      values.is_verified ? new Date() : null, updatedBy || null
    ]);
    return result.insertId;
  }

  async function update(id, values, updatedBy) {
    await ensureSchema();
    const [result] = await pool.query(`
      UPDATE cooperative_locations SET
        c_code = ?, district = ?, address_text = ?, latitude = ?, longitude = ?,
        google_maps_url = ?, website_url = ?, is_verified = ?, is_public = ?,
        verified_at = CASE WHEN ? = 1 THEN COALESCE(verified_at, CURRENT_TIMESTAMP) ELSE NULL END,
        updated_by = ?
      WHERE id = ?
    `, [
      values.c_code, values.district || null, values.address_text || null,
      values.latitude, values.longitude, values.google_maps_url || null, values.website_url || null,
      values.is_verified ? 1 : 0, values.is_public ? 1 : 0, values.is_verified ? 1 : 0,
      updatedBy || null, id
    ]);
    return result.affectedRows;
  }

  async function getPublicMapLocations() {
    await ensureSchema();
    const [rows] = await pool.query(`
      SELECT
        cl.c_code AS code,
        ac.c_name AS name,
        CASE
          WHEN ac.coop_group = 'กลุ่มเกษตรกร' THEN 'farmer'
          WHEN ac.in_out_group LIKE '%นอก%' THEN 'non_agri'
          ELSE 'agri'
        END AS type,
        cl.district,
        CAST(cl.latitude AS DOUBLE) AS latitude,
        CAST(cl.longitude AS DOUBLE) AS longitude,
        cl.google_maps_url AS googleMapsUrl,
        cl.website_url AS websiteUrl
      FROM cooperative_locations cl
      INNER JOIN active_coop ac ON ac.c_code = cl.c_code
      WHERE cl.is_public = 1 AND cl.is_verified = 1 AND ac.c_status = 'ดำเนินการ'
      ORDER BY ac.c_name ASC
    `);
    return rows;
  }

  return { ensureSchema, list, getById, getByCode, listInstitutions, create, update, getPublicMapLocations };
}

module.exports = createStore();
module.exports.createStore = createStore;
