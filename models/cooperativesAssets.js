const db = require('../config/db');

class CooperativesAssets {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM cooperatives_assets ORDER BY coop_name, asset_code');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM cooperatives_assets WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByCoopCode(coopCode) {
    const [rows] = await db.query('SELECT * FROM cooperatives_assets WHERE coop_code = ? ORDER BY asset_code', [coopCode]);
    return rows;
  }

  static async create(data) {
    const {
      coop_code, asset_code, category, coop_name, address, subdistrict, district, province, postcode,
      machine_type, description, quantity, quantity_unit, capacity_value, capacity_unit, status,
      latitude, longitude, usage_group, crop, spec_value, spec_unit, year_be, procurement_code,
      project, price_total, price_support, price_coop, remark, contact_name, contact_phone, updated_date
    } = data;

    const [result] = await db.query(
      `INSERT INTO cooperatives_assets (
        coop_code, asset_code, category, coop_name, address, subdistrict, district, province, postcode,
        machine_type, description, quantity, quantity_unit, capacity_value, capacity_unit, status,
        latitude, longitude, usage_group, crop, spec_value, spec_unit, year_be, procurement_code,
        project, price_total, price_support, price_coop, remark, contact_name, contact_phone, updated_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        coop_code, asset_code, category, coop_name, address, subdistrict, district, province, postcode,
        machine_type, description, quantity, quantity_unit, capacity_value, capacity_unit, status,
        latitude, longitude, usage_group, crop, spec_value, spec_unit, year_be, procurement_code,
        project, price_total, price_support, price_coop, remark, contact_name, contact_phone, updated_date
      ]
    );
    return result.insertId;
  }

  static async update(id, data) {
    const {
      coop_code, asset_code, category, coop_name, address, subdistrict, district, province, postcode,
      machine_type, description, quantity, quantity_unit, capacity_value, capacity_unit, status,
      latitude, longitude, usage_group, crop, spec_value, spec_unit, year_be, procurement_code,
      project, price_total, price_support, price_coop, remark, contact_name, contact_phone, updated_date
    } = data;

    const [result] = await db.query(
      `UPDATE cooperatives_assets SET
        coop_code=?, asset_code=?, category=?, coop_name=?, address=?, subdistrict=?, district=?, province=?, postcode=?,
        machine_type=?, description=?, quantity=?, quantity_unit=?, capacity_value=?, capacity_unit=?, status=?,
        latitude=?, longitude=?, usage_group=?, crop=?, spec_value=?, spec_unit=?, year_be=?, procurement_code=?,
        project=?, price_total=?, price_support=?, price_coop=?, remark=?, contact_name=?, contact_phone=?, updated_date=?
      WHERE id = ?`,
      [
        coop_code, asset_code, category, coop_name, address, subdistrict, district, province, postcode,
        machine_type, description, quantity, quantity_unit, capacity_value, capacity_unit, status,
        latitude, longitude, usage_group, crop, spec_value, spec_unit, year_be, procurement_code,
        project, price_total, price_support, price_coop, remark, contact_name, contact_phone, updated_date, id
      ]
    );
    return result.affectedRows;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM cooperatives_assets WHERE id = ?', [id]);
    return result.affectedRows;
  }

  static async search(filters = {}) {
    let whereClauses = [];
    let params = [];

    if (filters.coop_code) {
      whereClauses.push('coop_code = ?');
      params.push(filters.coop_code);
    }
    if (filters.category) {
      whereClauses.push('category LIKE ?');
      params.push(`%${filters.category}%`);
    }
    if (filters.machine_type) {
      whereClauses.push('machine_type LIKE ?');
      params.push(`%${filters.machine_type}%`);
    }
    if (filters.status) {
      whereClauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters.crop) {
      whereClauses.push('crop LIKE ?');
      params.push(`%${filters.crop}%`);
    }

    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM cooperatives_assets ${whereClause} ORDER BY coop_name, asset_code`;

    const [rows] = await db.query(sql, params);
    return rows;
  }
}

module.exports = CooperativesAssets;
