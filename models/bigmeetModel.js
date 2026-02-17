const db = require('../config/db');

const table = 'bigmeet';

// Cache for frequently accessed data
let coopCache = null;
let coopCacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

module.exports = {
  async findByCodes(codes = []) {
    if (!Array.isArray(codes) || codes.length === 0) return [];
    const placeholders = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT big_code, big_date FROM ${table} WHERE big_code IN (${placeholders})` ,
      codes
    );
    return rows;
  },
  async findAll() {
    const [rows] = await db.query(`
      SELECT b.*, c.c_name, TRIM(c.end_day) AS end_day 
      FROM bigmeet b
      LEFT JOIN active_coop c ON b.big_code = c.c_code
      ORDER BY b.big_id DESC
    `);
    return rows;
  },

  async findPage(limit = 10, offset = 0, filters = {}) {
    let query = `
      SELECT b.*, c.c_name, TRIM(c.end_day) AS end_day 
      FROM bigmeet b
      LEFT JOIN active_coop c ON b.big_code = c.c_code
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (filters.search) {
      query += ` AND (c.c_name LIKE ? OR b.big_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (filters.year) {
      query += ` AND b.big_endyear = ?`;
      params.push(filters.year);
    }
    
    if (filters.type) {
      query += ` AND b.big_type = ?`;
      params.push(filters.type);
    }

    query += ` ORDER BY b.big_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, params);
    return rows;
  },

  async countAll(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM bigmeet b LEFT JOIN active_coop c ON b.big_code = c.c_code WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (c.c_name LIKE ? OR b.big_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (filters.year) {
      query += ` AND b.big_endyear = ?`;
      params.push(filters.year);
    }
    
    if (filters.type) {
      query += ` AND b.big_type = ?`;
      params.push(filters.type);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  },

  async findById(id) {
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE big_id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  },

  async create(data) {
    const payload = {
      big_code: data.big_code,
      big_endyear: data.big_endyear,
      big_type: data.big_type,
      big_date: data.big_date,
      big_saveby: data.big_saveby,
      big_savedate: data.big_savedate,
    };
    
    const [result] = await db.query(
      `INSERT INTO ${table} (big_code, big_endyear, big_type, big_date, big_saveby, big_savedate)
       VALUES (?, ?, ?, ?, ?, ?)`,

      [
        payload.big_code,
        payload.big_endyear,
        payload.big_type,
        payload.big_date,
        payload.big_saveby,
        payload.big_savedate,
      ]
    );
    
    // Clear cache after modification
    this.clearCoopCache();
    
    return { big_id: result.insertId, ...payload };
  },

  async update(id, data) {
    const fields = ['big_code', 'big_endyear', 'big_type', 'big_date', 'big_saveby', 'big_savedate'];
    const setParts = [];
    const values = [];
    
    fields.forEach((f) => {
      if (data[f] !== undefined) {
        setParts.push(`${f} = ?`);
        values.push(data[f]);
      }
    });
    
    if (setParts.length === 0) return this.findById(id);
    
    values.push(id);
    await db.query(`UPDATE ${table} SET ${setParts.join(', ')} WHERE big_id = ?`, values);
    
    // Clear cache after modification
    this.clearCoopCache();
    
    return this.findById(id);
  },

  async remove(id) {
    const [result] = await db.query(`DELETE FROM ${table} WHERE big_id = ?`, [id]);
    
    if (result.affectedRows > 0) {
      // Clear cache after modification
      this.clearCoopCache();
    }
    
    return result.affectedRows > 0;
  },

  // Active cooperatives for select (c_group, c_code, c_name)
  async allcoop() {
    // Check cache first
    if (this.isCoopCacheValid()) {
      return coopCache;
    }

    const [rows] = await db.query(
      'SELECT c_group, c_code, c_name FROM active_coop WHERE c_status = "ดำเนินการ" ORDER BY c_group ASC, c_code ASC'
    );
    
    // Update cache
    coopCache = rows;
    coopCacheExpiry = Date.now() + CACHE_DURATION;
    
    return rows;
  },

  // Distinct groups from active_coop
  async allcoopGroups() {
    const coops = await this.allcoop();
    return [...new Set(coops.map(c => c.c_group))].sort();
  },

  // Cache management
  isCoopCacheValid() {
    return coopCache && coopCacheExpiry && Date.now() < coopCacheExpiry;
  },

  clearCoopCache() {
    coopCache = null;
    coopCacheExpiry = null;
  },

  // Bulk operations
  async bulkCreate(dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error('Invalid data array for bulk create');
    }

    const values = dataArray.map(data => [
      data.big_code,
      data.big_endyear,
      data.big_type,
      data.big_date,
      data.big_saveby,
      data.big_savedate
    ]);

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const flatValues = values.flat();

    const [result] = await db.query(
      `INSERT INTO ${table} (big_code, big_endyear, big_type, big_date, big_saveby, big_savedate)
       VALUES ${placeholders}`,
      flatValues
    );

    this.clearCoopCache();
    return result;
  },

  async bulkUpdate(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Invalid updates array for bulk update');
    }

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      for (const update of updates) {
        const { id, data } = update;
        const fields = ['big_code', 'big_endyear', 'big_type', 'big_date', 'big_saveby', 'big_savedate'];
        const setParts = [];
        const values = [];
        
        fields.forEach((f) => {
          if (data[f] !== undefined) {
            setParts.push(`${f} = ?`);
            values.push(data[f]);
          }
        });
        
        if (setParts.length > 0) {
          values.push(id);
          await connection.query(`UPDATE ${table} SET ${setParts.join(', ')} WHERE big_id = ?`, values);
        }
      }
      
      await connection.commit();
      this.clearCoopCache();
      return { updated: updates.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('Invalid IDs array for bulk delete');
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await db.query(
      `DELETE FROM ${table} WHERE big_id IN (${placeholders})`,
      ids
    );

    if (result.affectedRows > 0) {
      this.clearCoopCache();
    }

    return result;
  }
};
