const db = require('../config/db');

const table = 'bigmeet';

// Cache for frequently accessed data
let coopCache = null;
let coopCacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let schemaReadyPromise = null;

async function ensureColumn(tableName, columnName, columnSql, afterColumn = null) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length) return;
  const afterSql = afterColumn ? ` AFTER ${afterColumn}` : '';
  await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}${afterSql}`);
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bigmeet (
        big_id INT AUTO_INCREMENT PRIMARY KEY,
        big_code VARCHAR(100) NOT NULL,
        big_endyear VARCHAR(4) NOT NULL,
        big_fiscal_end_date DATE NULL,
        big_type VARCHAR(250) NOT NULL,
        big_meeting_status ENUM('met_within_150', 'met_over_150', 'not_met') NOT NULL DEFAULT 'met_within_150',
        big_deadline_date DATE NULL,
        big_date DATE NULL,
        big_reason TEXT NULL,
        big_note TEXT NULL,
        big_saveby VARCHAR(250) NOT NULL,
        big_savedate DATE NOT NULL
      )
    `);
    await ensureColumn(table, 'big_fiscal_end_date', 'big_fiscal_end_date DATE NULL', 'big_endyear');
    await ensureColumn(table, 'big_meeting_status', "big_meeting_status ENUM('met_within_150', 'met_over_150', 'not_met') NOT NULL DEFAULT 'met_within_150'", 'big_type');
    await ensureColumn(table, 'big_deadline_date', 'big_deadline_date DATE NULL', 'big_meeting_status');
    await ensureColumn(table, 'big_reason', 'big_reason TEXT NULL', 'big_date');
    await ensureColumn(table, 'big_note', 'big_note TEXT NULL', 'big_reason');
    await db.query('ALTER TABLE bigmeet MODIFY big_date DATE NULL');
    await db.query(
      `UPDATE ${table}
       SET big_endyear = CAST(big_endyear AS UNSIGNED) + 543
       WHERE big_endyear REGEXP '^[0-9]{4}$'
         AND CAST(big_endyear AS UNSIGNED) < 2400`
    );
  })();

  return schemaReadyPromise;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return trimmed;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function budgetYearSqlExpr(alias = 'b') {
  return `CASE
    WHEN COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date) IS NULL THEN NULL
    WHEN MONTH(COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date)) >= 10
      THEN YEAR(COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date)) + 544
    ELSE YEAR(COALESCE(${alias}.big_deadline_date, ${alias}.big_date, ${alias}.big_fiscal_end_date)) + 543
  END`;
}

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function deriveMonthDayFromCoop(coop = {}) {
  const endDay = normalizeText(coop.end_day);
  if (/^\d{2}-\d{2}$/.test(endDay)) return endDay;

  const thaiMonthToMm = {
    มกราคม: '01',
    กุมภาพันธ์: '02',
    มีนาคม: '03',
    เมษายน: '04',
    พฤษภาคม: '05',
    มิถุนายน: '06',
    กรกฎาคม: '07',
    สิงหาคม: '08',
    กันยายน: '09',
    ตุลาคม: '10',
    พฤศจิกายน: '11',
    ธันวาคม: '12'
  };
  const endDate = normalizeText(coop.end_date).replace(/\s+/g, '');
  const match = endDate.match(/^(\d{1,2})([^\d]+)$/);
  if (!match) return null;
  const day = String(match[1]).padStart(2, '0');
  const month = thaiMonthToMm[match[2]];
  return month ? `${month}-${day}` : null;
}

function fiscalYearRangeToIso(fiscalYear) {
  const fy = Number(fiscalYear || 0);
  if (!fy) return null;
  return {
    start: `${fy - 544}-10-01`,
    end: `${fy - 543}-09-30`
  };
}

function accountingEndRangeToIso(fiscalYear) {
  const fy = Number(fiscalYear || 0);
  if (!fy) return null;
  return {
    start: `${fy - 544}-04-30`,
    end: `${fy - 543}-03-31`
  };
}

function getCurrentBudgetYear(date = new Date()) {
  const month = date.getMonth() + 1;
  const ceYear = date.getFullYear();
  return month >= 10 ? ceYear + 544 : ceYear + 543;
}

function isoFromMonthDayInRange(monthDay, range) {
  const md = normalizeText(monthDay);
  if (!/^\d{2}-\d{2}$/.test(md) || !range) return null;
  const startMonthDay = range.start.slice(5);
  const endMonthDay = range.end.slice(5);
  if (md >= startMonthDay) return `${range.start.slice(0, 4)}-${md}`;
  if (md <= endMonthDay) return `${range.end.slice(0, 4)}-${md}`;
  return null;
}

function getInstitutionCategory(row = {}) {
  const coopGroup = normalizeText(row.coop_group);
  const inOutGroup = normalizeText(row.in_out_group).replace(/\u00a0/g, ' ');
  if (coopGroup === 'กลุ่มเกษตรกร') return 'farmer';
  if (coopGroup === 'สหกรณ์' && !inOutGroup.includes('นอก')) return 'agri';
  return 'non_agri';
}

module.exports = {
  async findByCodes(codes = []) {
    await ensureSchema();
    if (!Array.isArray(codes) || codes.length === 0) return [];
    const placeholders = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT
         big_code,
         big_date,
         big_meeting_status,
         big_fiscal_end_date,
         big_deadline_date,
         big_endyear
       FROM ${table}
       WHERE big_code IN (${placeholders})` ,
      codes
    );
    return rows;
  },

  async getLatestFiscalYearCategorySummary() {
    await ensureSchema();
    const currentBudgetYear = getCurrentBudgetYear();
    const [yearRows] = await db.query(`
      SELECT MAX(budget_year) AS latest_budget_year
      FROM (
        SELECT ${budgetYearSqlExpr('b')} AS budget_year
        FROM ${table} b
      ) budget_source
      WHERE budget_year IS NOT NULL
        AND budget_year <= ?
    `, [currentBudgetYear]);

    const latestBudgetYear = Number(yearRows?.[0]?.latest_budget_year || 0);
    const fiscalRange = fiscalYearRangeToIso(latestBudgetYear);
    const accountingRange = accountingEndRangeToIso(latestBudgetYear);
    if (!latestBudgetYear || !fiscalRange || !accountingRange) {
      return { fiscalYear: 0, categories: [] };
    }

    const [activeRows] = await db.query(`
      SELECT
        c.c_code,
        c.c_name,
        TRIM(c.end_date) AS end_date,
        TRIM(c.end_day) AS end_day,
        REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
        c.coop_group
      FROM active_coop c
      WHERE c.c_status = 'ดำเนินการ'
      ORDER BY c.c_code ASC
    `);

    const [meetingRows] = await db.query(`
      SELECT
        b.big_code,
        b.big_date,
        b.big_meeting_status,
        b.big_deadline_date,
        b.big_id
      FROM ${table} b
      WHERE (
        b.big_date BETWEEN ? AND ?
        OR (
          b.big_meeting_status = 'not_met'
          AND b.big_deadline_date BETWEEN ? AND ?
        )
      )
      ORDER BY b.big_date DESC, b.big_id DESC
    `, [fiscalRange.start, fiscalRange.end, fiscalRange.start, fiscalRange.end]);

    const categoryMap = {
      agri: {
        key: 'agri',
        label: 'สหกรณ์ภาคการเกษตร',
        shortLabel: 'ภาคการเกษตร',
        icon: 'bi-flower1',
        tone: 'green',
        total: 0,
        met: 0,
        notMet: 0
      },
      non_agri: {
        key: 'non_agri',
        label: 'สหกรณ์นอกภาค',
        shortLabel: 'นอกภาค',
        icon: 'bi-buildings',
        tone: 'teal',
        total: 0,
        met: 0,
        notMet: 0
      },
      farmer: {
        key: 'farmer',
        label: 'กลุ่มเกษตรกร',
        shortLabel: 'กลุ่มเกษตรกร',
        icon: 'bi-people',
        tone: 'amber',
        total: 0,
        met: 0,
        notMet: 0
      }
    };

    const requiredByCode = new Map();
    (activeRows || []).forEach((row) => {
      const fiscalEndDate = isoFromMonthDayInRange(deriveMonthDayFromCoop(row), accountingRange);
      if (!fiscalEndDate) return;
      const key = normalizeText(row.c_code);
      const categoryKey = getInstitutionCategory(row);
      requiredByCode.set(key, { categoryKey });
      categoryMap[categoryKey].total += 1;
    });

    const metByCode = new Set();
    (meetingRows || []).forEach((row) => {
      const code = normalizeText(row.big_code);
      if (!requiredByCode.has(code) || metByCode.has(code)) return;
      if (normalizeText(row.big_meeting_status) === 'not_met') return;
      metByCode.add(code);
    });

    requiredByCode.forEach((row, code) => {
      const target = categoryMap[row.categoryKey];
      if (metByCode.has(code)) target.met += 1;
      else target.notMet += 1;
    });

    return {
      fiscalYear: latestBudgetYear,
      fiscalYearThai: latestBudgetYear,
      fiscalRange,
      categories: ['agri', 'non_agri', 'farmer'].map((key) => {
        const item = categoryMap[key];
        return {
          ...item,
          percent: item.total > 0 ? (item.met / item.total) * 100 : 0
        };
      })
    };
  },

  async findAll() {
    await ensureSchema();
    const [rows] = await db.query(`
      SELECT
        b.*,
        ${budgetYearSqlExpr('b')} AS big_budget_year,
        c.c_name,
        TRIM(c.end_date) AS end_date,
        TRIM(c.end_day) AS end_day,
        c.c_group,
        REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
        c.coop_group
      FROM bigmeet b
      LEFT JOIN active_coop c ON b.big_code = c.c_code
      ORDER BY 
        (b.big_date IS NULL) ASC,
        b.big_date DESC,
        b.big_id DESC
    `);
    return rows;
  },

  async findPage(limit = 10, offset = 0, filters = {}) {
    await ensureSchema();
    let query = `
      SELECT
        b.*,
        ${budgetYearSqlExpr('b')} AS big_budget_year,
        c.c_name,
        TRIM(c.end_date) AS end_date,
        TRIM(c.end_day) AS end_day,
        c.c_group,
        REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
        c.coop_group
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

    if (filters.meetingStatus) {
      query += ` AND b.big_meeting_status = ?`;
      params.push(filters.meetingStatus);
    }

    if (filters.budgetYear) {
      query += ` AND ${budgetYearSqlExpr('b')} = ?`;
      params.push(filters.budgetYear);
    }

    query += ` ORDER BY b.big_id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, params);
    return rows;
  },

  async countAll(filters = {}) {
    await ensureSchema();
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

    if (filters.meetingStatus) {
      query += ` AND b.big_meeting_status = ?`;
      params.push(filters.meetingStatus);
    }

    if (filters.budgetYear) {
      query += ` AND ${budgetYearSqlExpr('b')} = ?`;
      params.push(filters.budgetYear);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  },

  async findById(id) {
    await ensureSchema();
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE big_id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  },

  async create(data) {
    await ensureSchema();
    const payload = {
      big_code: data.big_code,
      big_endyear: data.big_endyear,
      big_fiscal_end_date: normalizeDateOnly(data.big_fiscal_end_date),
      big_type: data.big_type,
      big_meeting_status: data.big_meeting_status || (data.big_date ? 'met_within_150' : 'not_met'),
      big_deadline_date: normalizeDateOnly(data.big_deadline_date),
      big_date: normalizeDateOnly(data.big_date),
      big_reason: data.big_reason || null,
      big_note: data.big_note || null,
      big_saveby: data.big_saveby,
      big_savedate: data.big_savedate,
    };
    
    const [result] = await db.query(
      `INSERT INTO ${table} (big_code, big_endyear, big_fiscal_end_date, big_type, big_meeting_status, big_deadline_date, big_date, big_reason, big_note, big_saveby, big_savedate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.big_code,
        payload.big_endyear,
        payload.big_fiscal_end_date,
        payload.big_type,
        payload.big_meeting_status,
        payload.big_deadline_date,
        payload.big_date,
        payload.big_reason,
        payload.big_note,
        payload.big_saveby,
        payload.big_savedate,
      ]
    );
    
    // Clear cache after modification
    this.clearCoopCache();
    
    return { big_id: result.insertId, ...payload };
  },

  async update(id, data) {
    await ensureSchema();
    const fields = ['big_code', 'big_endyear', 'big_fiscal_end_date', 'big_type', 'big_meeting_status', 'big_deadline_date', 'big_date', 'big_reason', 'big_note', 'big_saveby', 'big_savedate'];
    const setParts = [];
    const values = [];
    
    fields.forEach((f) => {
      if (data[f] !== undefined) {
        const normalized = f.includes('date') ? normalizeDateOnly(data[f]) : data[f];
        setParts.push(`${f} = ?`);
        values.push(normalized);
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
    await ensureSchema();
    const [result] = await db.query(`DELETE FROM ${table} WHERE big_id = ?`, [id]);
    
    if (result.affectedRows > 0) {
      // Clear cache after modification
      this.clearCoopCache();
    }
    
    return result.affectedRows > 0;
  },

  // Active cooperatives for select (c_group, c_code, c_name)
  async allcoop() {
    await ensureSchema();
    // Check cache first
    if (this.isCoopCacheValid()) {
      return coopCache;
    }

    const [rows] = await db.query(
      "SELECT c_group, c_code, c_name, end_date, end_day, in_out_group, coop_group FROM active_coop WHERE c_status = 'ดำเนินการ' ORDER BY c_group ASC, c_code ASC"
    );
    
    // Update cache
    coopCache = rows;
    coopCacheExpiry = Date.now() + CACHE_DURATION;
    
    return rows;
  },

  // Distinct groups from active_coop
  async allcoopGroups() {
    await ensureSchema();
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
    await ensureSchema();
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error('Invalid data array for bulk create');
    }

    const values = dataArray.map(data => [
      data.big_code,
      data.big_endyear,
      normalizeDateOnly(data.big_fiscal_end_date),
      data.big_type,
      data.big_meeting_status || (data.big_date ? 'met_within_150' : 'not_met'),
      normalizeDateOnly(data.big_deadline_date),
      normalizeDateOnly(data.big_date),
      data.big_reason || null,
      data.big_note || null,
      data.big_saveby,
      data.big_savedate
    ]);

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flatValues = values.flat();

    const [result] = await db.query(
      `INSERT INTO ${table} (big_code, big_endyear, big_fiscal_end_date, big_type, big_meeting_status, big_deadline_date, big_date, big_reason, big_note, big_saveby, big_savedate)
       VALUES ${placeholders}`,
      flatValues
    );

    this.clearCoopCache();
    return result;
  },

  async bulkUpdate(updates) {
    await ensureSchema();
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Invalid updates array for bulk update');
    }

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      for (const update of updates) {
        const { id, data } = update;
        const fields = ['big_code', 'big_endyear', 'big_fiscal_end_date', 'big_type', 'big_meeting_status', 'big_deadline_date', 'big_date', 'big_reason', 'big_note', 'big_saveby', 'big_savedate'];
        const setParts = [];
        const values = [];
        
        fields.forEach((f) => {
          if (data[f] !== undefined) {
            setParts.push(`${f} = ?`);
            values.push(f.includes('date') ? normalizeDateOnly(data[f]) : data[f]);
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
    await ensureSchema();
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
