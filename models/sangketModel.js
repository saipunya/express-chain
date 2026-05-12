const db = require('../config/db');
const ExcelJS = require('exceljs');

const CATEGORY_SEED = [
  { id: 1, name: 'ข้อสังเกตด้านการเงินและบัญชี', sort_order: 1 },
  { id: 2, name: 'ข้อสังเกตการปฏิบัติไม่เป็นไปตามกฎหมาย กฎกระทรวง ระเบียบ คำสั่ง ประกาศ คำแนะนำ', sort_order: 2 },
  { id: 3, name: 'ข้อสังเกตการปฏิบัติไม่เป็นไปตามข้อบังคับ ระเบียบประกาศ มติที่ประชุมใหญ่ คณะกรรมการฯ', sort_order: 3 },
  { id: 4, name: 'ข้อสังเกตเกี่ยวกับพฤติกรรมที่อาจก่อให้เกิดความเสียหาย', sort_order: 4 },
  { id: 5, name: 'ทุจริต', sort_order: 5 },
  { id: 6, name: 'ข้อสังเกตอื่น ๆ', sort_order: 6 }
];

let schemaReadyPromise = null;
let activeCoopLookupPromise = null;

function textValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(textValue).filter(Boolean).join(' ');
    }
    if (value.richText) {
      return value.richText.map((part) => part.text || '').join('');
    }
    if (value.text) {
      return String(value.text).trim();
    }
  }
  return String(value).trim();
}

function numberValue(value) {
  const text = textValue(value).replace(/,/g, '');
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateText(value) {
  const text = textValue(value);
  return text || null;
}

function normalizeArray(value) {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }
  const text = String(value)
    .split(',')
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
  return text;
}

function parsePromotionGroupNo(sheetName) {
  const match = String(sheetName || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function coopTypeFromSheet(sheetName) {
  return String(sheetName || '').includes('1') ? 'group_farmer' : 'cooperative';
}

function severityFromRow(row) {
  if (row[10]) return 'serious_order';
  if (row[11]) return 'advice';
  if (row[12]) return 'fact_check';
  return null;
}

function auditTypeFromRow(row) {
  if (row[6]) return 'interim';
  if (row[7]) return 'annual';
  return null;
}

function categoryIdsFromRow(row) {
  const ids = [];
  for (let idx = 15; idx <= 20; idx += 1) {
    if (row[idx]) {
      ids.push(idx - 14);
    }
  }
  return ids;
}

function severityActionType(severityCase) {
  switch (severityCase) {
    case 'serious_order':
      return 'order';
    case 'advice':
      return 'advice';
    case 'fact_check':
      return 'fact_check';
    default:
      return 'follow_up';
  }
}

function normalizeCoopName(value) {
  let text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return '';

  text = text
    .replace(/\s*จำกัด\s*\(มหาชน\)\s*$/u, '')
    .replace(/\s*จำกัด\s*$/u, '')
    .trim();

  if (/^สค\.\s*/u.test(text)) {
    text = text.replace(/^สค\.\s*/u, 'สหกรณ์เครดิตยูเนี่ยน ');
  } else if (/^สอ\.\s*/u.test(text)) {
    text = text.replace(/^สอ\.\s*/u, 'สหกรณ์ออมทรัพย์ ');
  } else if (/^สห\.\s*/u.test(text)) {
    text = text.replace(/^สห\.\s*/u, 'สหกรณ์ ');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function comparableCoopName(value) {
  return normalizeCoopName(value)
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

async function getActiveCoopLookup() {
  if (activeCoopLookupPromise) return activeCoopLookupPromise;

  activeCoopLookupPromise = (async () => {
    const [rows] = await db.query(
      'SELECT c_code, c_name, coop_group FROM active_coop WHERE c_name IS NOT NULL AND c_name <> ""'
    );

    const exactMap = new Map();
    const normalizedMap = new Map();

    for (const row of rows) {
      const rawKey = String(row.c_name || '').trim();
      const normalizedKey = normalizeCoopName(row.c_name);
      const comparableKey = comparableCoopName(row.c_name);

      if (rawKey && !exactMap.has(rawKey)) {
        exactMap.set(rawKey, row);
      }

      const bucket = normalizedMap.get(normalizedKey) || [];
      bucket.push(row);
      normalizedMap.set(normalizedKey, bucket);

      const comparableBucket = normalizedMap.get(comparableKey) || [];
      comparableBucket.push(row);
      normalizedMap.set(comparableKey, comparableBucket);
    }

    return { rows, exactMap, normalizedMap };
  })();

  return activeCoopLookupPromise;
}

async function resolveActiveCoopByName(name) {
  const lookup = await getActiveCoopLookup();
  const raw = String(name || '').trim();
  if (!raw) return null;

  const direct = lookup.exactMap.get(raw);
  if (direct) return direct;

  const normalized = normalizeCoopName(raw);
  const comparable = comparableCoopName(raw);
  const candidates = [
    ...(lookup.normalizedMap.get(normalized) || []),
    ...(lookup.normalizedMap.get(comparable) || [])
  ];

  if (!candidates.length) return null;

  const ranked = candidates
    .map((row) => {
      const activeNormalized = normalizeCoopName(row.c_name);
      const activeComparable = comparableCoopName(row.c_name);
      const exact = activeNormalized === normalized || activeComparable === comparable;
      const includes = activeNormalized.includes(normalized) || normalized.includes(activeNormalized) || activeComparable.includes(comparable) || comparable.includes(activeComparable);
      return { row, exact, includes, lenDiff: Math.abs(activeNormalized.length - normalized.length) };
    })
    .sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.includes) - Number(a.includes) || a.lenDiff - b.lenDiff);

  return ranked[0]?.row || null;
}

async function resolveActiveCoopByCode(code) {
  const lookup = await getActiveCoopLookup();
  const raw = String(code || '').trim();
  if (!raw) return null;
  return lookup.rows.find((row) => String(row.c_code || '').trim() === raw) || null;
}

async function getActiveCoopHierarchy() {
  const [rows] = await db.query(
    `SELECT c_code, c_name, coop_group, c_group
     FROM active_coop
     WHERE c_name IS NOT NULL AND c_name <> ''
     ORDER BY coop_group ASC, c_group ASC, c_name ASC`
  );

  const coopGroups = [];
  const groupIndex = new Map();

  for (const row of rows) {
    const coopGroup = String(row.coop_group || '').trim() || 'ไม่ระบุ';
    const cGroup = String(row.c_group || '').trim() || 'ไม่ระบุกลุ่ม';
    const coopGroupKey = coopGroup;
    const cGroupKey = `${coopGroupKey}::${cGroup}`;

    if (!groupIndex.has(coopGroupKey)) {
      const node = { coop_group: coopGroup, c_groups: [] };
      groupIndex.set(coopGroupKey, node);
      coopGroups.push(node);
    }

    const coopNode = groupIndex.get(coopGroupKey);
    let cGroupNode = coopNode.c_groups.find((group) => group.c_group === cGroup);
    if (!cGroupNode) {
      cGroupNode = { c_group: cGroup, items: [] };
      coopNode.c_groups.push(cGroupNode);
    }
    cGroupNode.items.push({
      c_code: row.c_code,
      c_name: row.c_name,
      coop_group: row.coop_group,
      c_group: row.c_group
    });
  }

  return coopGroups;
}

async function backfillCooperativeCodes() {
  const [rows] = await db.query(
    'SELECT id, name, c_code FROM sangket_cooperatives WHERE name IS NOT NULL AND name <> ""'
  );

  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const match = await resolveActiveCoopByName(row.name);
    const nextCode = match?.c_code || null;
    const currentCode = row.c_code || null;
    if (nextCode && nextCode !== currentCode) {
      // eslint-disable-next-line no-await-in-loop
      await db.query('UPDATE sangket_cooperatives SET c_code = ? WHERE id = ?', [nextCode, row.id]);
    }
  }
}

async function ensureColumn(tableName, columnName, columnSql, afterColumn = null) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length) return;
  const afterSql = afterColumn ? ` AFTER ${afterColumn}` : '';
  await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}${afterSql}`);
}

async function ensureIndex(tableName, indexName, createSql) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?`,
    [tableName, indexName]
  );
  if (rows.length) return;
  await db.query(createSql);
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS sangket_cooperatives (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        c_code VARCHAR(20) NULL,
        coop_type ENUM('cooperative', 'group_farmer') NOT NULL DEFAULT 'cooperative',
        promotion_group_no TINYINT NULL,
        district VARCHAR(120) NULL,
        status VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_coop (name, coop_type, promotion_group_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensureColumn('sangket_cooperatives', 'c_code', 'c_code VARCHAR(20) NULL', 'name');
    await ensureIndex(
      'sangket_cooperatives',
      'idx_sangket_cooperatives_c_code',
      'CREATE INDEX idx_sangket_cooperatives_c_code ON sangket_cooperatives (c_code)'
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS sangket_audit_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cooperative_id INT NOT NULL,
        fiscal_year_end VARCHAR(50) NULL,
        auditor_name VARCHAR(255) NULL,
        audit_office_letter_no VARCHAR(100) NULL,
        audit_office_letter_date VARCHAR(50) NULL,
        received_date VARCHAR(50) NULL,
        audit_type ENUM('interim', 'annual') NULL,
        source_sheet VARCHAR(20) NULL,
        source_row INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_report_coop (cooperative_id),
        KEY idx_report_letter (audit_office_letter_no),
        KEY idx_report_date (received_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS sangket_observations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        audit_report_id INT NOT NULL,
        observation_no INT NULL,
        observation_text TEXT NULL,
        potential_damage_amount DECIMAL(15,2) NULL,
        severity_case ENUM('serious_order', 'advice', 'fact_check') NULL,
        category_id INT NULL,
        status ENUM('new', 'in_progress', 'resolved', 'monitoring', 'closed') NOT NULL DEFAULT 'new',
        responsible_user_id INT NULL,
        due_date DATE NULL,
        resolved_date DATE NULL,
        remark TEXT NULL,
        source_sheet VARCHAR(20) NULL,
        source_row INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_obs_report (audit_report_id),
        KEY idx_obs_status (status),
        KEY idx_obs_category (category_id),
        KEY idx_obs_due (due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS sangket_observation_categories (
        id INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS sangket_observation_category_map (
        observation_id INT NOT NULL,
        category_id INT NOT NULL,
        PRIMARY KEY (observation_id, category_id),
        KEY idx_category_id (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS sangket_observation_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        observation_id INT NOT NULL,
        action_type ENUM('order', 'advice', 'fact_check', 'follow_up', 'close') NOT NULL,
        letter_no VARCHAR(100) NULL,
        letter_date VARCHAR(50) NULL,
        action_detail TEXT NULL,
        result TEXT NULL,
        created_by VARCHAR(255) NULL,
        attachment_path VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_action_obs (observation_id),
        KEY idx_action_type (action_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    for (const category of CATEGORY_SEED) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(
        `INSERT INTO sangket_observation_categories (id, name, sort_order)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)`,
        [category.id, category.name, category.sort_order]
      );
    }

    await backfillCooperativeCodes();
  })();

  return schemaReadyPromise;
}

async function findOrCreateCooperative({ name, cCode, coopType, promotionGroupNo, district, status }) {
  const nameMatch = await resolveActiveCoopByName(name);
  const codeMatch = cCode ? await resolveActiveCoopByCode(cCode) : null;
  const resolvedCode = nameMatch?.c_code || codeMatch?.c_code || null;
  const [existingRows] = await db.query(
    `SELECT * FROM sangket_cooperatives
     WHERE (c_code = ? AND c_code IS NOT NULL AND c_code <> '')
        OR (name = ? AND coop_type = ? AND (promotion_group_no <=> ?))
     LIMIT 1`,
    [resolvedCode, name, coopType, promotionGroupNo]
  );

  if (existingRows[0]) {
    const coop = existingRows[0];
    await db.query(
      `UPDATE sangket_cooperatives
       SET c_code = ?, district = ?, status = ?
       WHERE id = ?`,
      [resolvedCode, district || null, status || null, coop.id]
    );
    return coop.id;
  }

  const [result] = await db.query(
    `INSERT INTO sangket_cooperatives (name, c_code, coop_type, promotion_group_no, district, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, resolvedCode, coopType, promotionGroupNo || null, district || null, status || null]
  );
  return result.insertId;
}

async function findOrCreateReport(data) {
  const [existingRows] = await db.query(
    `SELECT * FROM sangket_audit_reports
     WHERE cooperative_id = ?
       AND (fiscal_year_end <=> ?)
       AND (auditor_name <=> ?)
       AND (audit_office_letter_no <=> ?)
       AND (audit_office_letter_date <=> ?)
       AND (received_date <=> ?)
       AND (audit_type <=> ?)
     ORDER BY id DESC
     LIMIT 1`,
    [
      data.cooperative_id,
      data.fiscal_year_end || null,
      data.auditor_name || null,
      data.audit_office_letter_no || null,
      data.audit_office_letter_date || null,
      data.received_date || null,
      data.audit_type || null
    ]
  );

  if (existingRows[0]) {
    const report = existingRows[0];
    await db.query(
      `UPDATE sangket_audit_reports
       SET fiscal_year_end = ?, auditor_name = ?, audit_office_letter_no = ?, audit_office_letter_date = ?, received_date = ?, audit_type = ?, source_sheet = ?, source_row = ?
       WHERE id = ?`,
      [
        data.fiscal_year_end || null,
        data.auditor_name || null,
        data.audit_office_letter_no || null,
        data.audit_office_letter_date || null,
        data.received_date || null,
        data.audit_type || null,
        data.source_sheet || null,
        data.source_row || null,
        report.id
      ]
    );
    return report.id;
  }

  const [result] = await db.query(
    `INSERT INTO sangket_audit_reports
      (cooperative_id, fiscal_year_end, auditor_name, audit_office_letter_no, audit_office_letter_date, received_date, audit_type, source_sheet, source_row)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.cooperative_id,
      data.fiscal_year_end || null,
      data.auditor_name || null,
      data.audit_office_letter_no || null,
      data.audit_office_letter_date || null,
      data.received_date || null,
      data.audit_type || null,
      data.source_sheet || null,
      data.source_row || null
    ]
  );
  return result.insertId;
}

async function attachCategories(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.observation_id).filter(Boolean);
  if (!ids.length) return rows;

  const placeholders = ids.map(() => '?').join(',');
  const [categoryRows] = await db.query(
    `SELECT m.observation_id, c.id, c.name, c.sort_order
     FROM sangket_observation_category_map m
     INNER JOIN sangket_observation_categories c ON c.id = m.category_id
     WHERE m.observation_id IN (${placeholders})
     ORDER BY c.sort_order ASC`,
    ids
  );

  const bucket = new Map();
  for (const row of categoryRows) {
    if (!bucket.has(row.observation_id)) bucket.set(row.observation_id, []);
    bucket.get(row.observation_id).push({ id: row.id, name: row.name, sort_order: row.sort_order });
  }

  return rows.map((row) => ({
    ...row,
    categories: bucket.get(row.observation_id) || [],
    category_names: (bucket.get(row.observation_id) || []).map((item) => item.name).join(', '),
    category_ids: (bucket.get(row.observation_id) || []).map((item) => item.id)
  }));
}

async function fetchObservationRows(whereSql, params, limitClause = '') {
  const [rows] = await db.query(
    `SELECT
      o.id AS observation_id,
      o.audit_report_id,
      o.observation_no,
      o.observation_text,
      o.potential_damage_amount,
      o.severity_case,
      o.category_id,
      o.status,
      o.responsible_user_id,
      o.due_date,
      o.resolved_date,
      o.remark,
      o.source_sheet,
      o.source_row,
      o.created_at AS observation_created_at,
      o.updated_at AS observation_updated_at,
      r.id AS report_id,
      r.fiscal_year_end,
      r.auditor_name,
      r.audit_office_letter_no,
      r.audit_office_letter_date,
      r.received_date,
      r.audit_type,
      r.source_sheet AS report_source_sheet,
      r.source_row AS report_source_row,
      c.id AS cooperative_id,
      c.name AS cooperative_name,
      c.c_code AS cooperative_code,
      c.coop_type,
      c.promotion_group_no,
      c.district,
      c.status AS cooperative_status
     FROM sangket_observations o
     INNER JOIN sangket_audit_reports r ON r.id = o.audit_report_id
     INNER JOIN sangket_cooperatives c ON c.id = r.cooperative_id
     ${whereSql}
     ORDER BY r.id DESC, o.observation_no ASC, o.id DESC
     ${limitClause}`,
    params
  );
  return rows;
}

function buildWhere(filters = {}) {
  const where = [];
  const params = [];

  if (filters.search) {
    const kw = `%${filters.search}%`;
    where.push('(c.name LIKE ? OR c.c_code LIKE ? OR r.auditor_name LIKE ? OR r.audit_office_letter_no LIKE ? OR o.observation_text LIKE ? OR o.remark LIKE ?)');
    params.push(kw, kw, kw, kw, kw, kw);
  }

  if (filters.groupNo) {
    where.push('c.promotion_group_no = ?');
    params.push(filters.groupNo);
  }

  if (filters.coopType) {
    where.push('c.coop_type = ?');
    params.push(filters.coopType);
  }

  if (filters.status) {
    where.push('o.status = ?');
    params.push(filters.status);
  }

  if (filters.severityCase) {
    where.push('o.severity_case = ?');
    params.push(filters.severityCase);
  }

  if (filters.auditType) {
    where.push('r.audit_type = ?');
    params.push(filters.auditType);
  }

  if (filters.categoryId) {
    where.push(
      'EXISTS (SELECT 1 FROM sangket_observation_category_map m WHERE m.observation_id = o.id AND m.category_id = ?)'
    );
    params.push(filters.categoryId);
  }

  if (filters.fiscalYearEnd) {
    where.push('r.fiscal_year_end LIKE ?');
    params.push(`%${filters.fiscalYearEnd}%`);
  }

  if (filters.cooperativeId) {
    where.push('c.id = ?');
    params.push(filters.cooperativeId);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function syncCategories(observationId, primaryCategoryId, categoryIds = []) {
  const ids = new Set(
    [primaryCategoryId, ...categoryIds]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  );

  await db.query('DELETE FROM sangket_observation_category_map WHERE observation_id = ?', [observationId]);
  if (!ids.size) return;

  for (const categoryId of ids) {
    // eslint-disable-next-line no-await-in-loop
    await db.query(
      `INSERT IGNORE INTO sangket_observation_category_map (observation_id, category_id)
       VALUES (?, ?)`,
      [observationId, categoryId]
    );
  }
}

async function addObservationAction(observationId, data = {}) {
  const actionType = data.action_type || data.severity_action_type || 'follow_up';
  if (!actionType && !data.letter_no && !data.action_detail && !data.result) return null;

  const [result] = await db.query(
    `INSERT INTO sangket_observation_actions
      (observation_id, action_type, letter_no, letter_date, action_detail, result, created_by, attachment_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      observationId,
      actionType,
      data.letter_no || null,
      data.letter_date || null,
      data.action_detail || null,
      data.result || null,
      data.created_by || null,
      data.attachment_path || null
    ]
  );

  if (actionType === 'close') {
    await db.query(
      `UPDATE sangket_observations
       SET status = 'closed', resolved_date = COALESCE(?, resolved_date)
       WHERE id = ?`,
      [data.letter_date || null, observationId]
    );
  } else if (['order', 'advice', 'fact_check', 'follow_up'].includes(actionType)) {
    await db.query(
      `UPDATE sangket_observations
       SET status = CASE
         WHEN status = 'new' THEN 'monitoring'
         ELSE status
       END
       WHERE id = ?`,
      [observationId]
    );
  }

  return result.insertId;
}

async function create(payload) {
  await ensureSchema();

  const cooperativeId = await findOrCreateCooperative({
    name: payload.cooperative_name || payload.sang_name || '',
    cCode: payload.c_code || null,
    coopType: payload.coop_type || payload.sang_coop_type || 'cooperative',
    promotionGroupNo: payload.promotion_group_no || payload.sang_group || null,
    district: payload.district || payload.sang_district || null,
    status: payload.cooperative_status || payload.sang_coop_status || null
  });

  const auditReportId = await findOrCreateReport({
    cooperative_id: cooperativeId,
    fiscal_year_end: payload.fiscal_year_end || payload.sang_enddate || null,
    auditor_name: payload.auditor_name || payload.sang_accounter || null,
    audit_office_letter_no: payload.audit_office_letter_no || payload.sang_rabbook || null,
    audit_office_letter_date: payload.audit_office_letter_date || payload.sang_rabdate || null,
    received_date: payload.received_date || payload.sang_sentdate || null,
    audit_type: payload.audit_type || payload.sang_check_type || null,
    source_sheet: payload.source_sheet || null,
    source_row: payload.source_row || null
  });

  const [result] = await db.query(
    `INSERT INTO sangket_observations
      (audit_report_id, observation_no, observation_text, potential_damage_amount, severity_case, category_id, status, responsible_user_id, due_date, resolved_date, remark, source_sheet, source_row)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditReportId,
      payload.observation_no || null,
      payload.observation_text || payload.sang_detail || null,
      payload.potential_damage_amount ?? payload.sang_money ?? null,
      payload.severity_case || payload.sang_severity_case || null,
      payload.category_id || null,
      payload.status || payload.sang_status || 'new',
      payload.responsible_user_id || null,
      payload.due_date || null,
      payload.resolved_date || null,
      payload.remark || payload.sang_maihed || null,
      payload.source_sheet || null,
      payload.source_row || null
    ]
  );

  await syncCategories(
    result.insertId,
    payload.category_id || null,
    normalizeArray(payload.category_ids)
  );

  if (payload.action_type || payload.letter_no || payload.action_detail || payload.result) {
    await addObservationAction(result.insertId, {
      action_type: payload.action_type || severityActionType(payload.severity_case || payload.sang_severity_case),
      letter_no: payload.letter_no || payload.sang_sentbook || null,
      letter_date: payload.letter_date || payload.sang_sentdate || null,
      action_detail: payload.action_detail || payload.observation_text || payload.sang_detail || null,
      result: payload.result || payload.remark || payload.sang_maihed || null,
      created_by: payload.created_by || payload.sang_saveby || 'system'
    });
  }

  return result.insertId;
}

async function update(id, payload) {
  await ensureSchema();
  const current = await getById(id);
  if (!current) {
    throw new Error('Observation not found');
  }

  await db.query(
    `UPDATE sangket_cooperatives
     SET name = ?, c_code = ?, coop_type = ?, promotion_group_no = ?, district = ?, status = ?
     WHERE id = ?`,
    [
      payload.cooperative_name || payload.sang_name || current.cooperative_name,
      (await resolveActiveCoopByName(payload.cooperative_name || payload.sang_name || current.cooperative_name))?.c_code
        || (payload.c_code && (await resolveActiveCoopByCode(payload.c_code))?.c_code)
        || current.cooperative_code
        || null,
      payload.coop_type || current.coop_type,
      payload.promotion_group_no || payload.sang_group || current.promotion_group_no || null,
      payload.district || current.district || null,
      payload.cooperative_status || current.cooperative_status || null,
      current.cooperative_id
    ]
  );

  await db.query(
    `UPDATE sangket_audit_reports
     SET fiscal_year_end = ?, auditor_name = ?, audit_office_letter_no = ?, audit_office_letter_date = ?, received_date = ?, audit_type = ?, source_sheet = ?, source_row = ?
     WHERE id = ?`,
    [
      payload.fiscal_year_end || payload.sang_enddate || current.fiscal_year_end || null,
      payload.auditor_name || payload.sang_accounter || current.auditor_name || null,
      payload.audit_office_letter_no || payload.sang_rabbook || current.audit_office_letter_no || null,
      payload.audit_office_letter_date || payload.sang_rabdate || current.audit_office_letter_date || null,
      payload.received_date || payload.sang_sentdate || current.received_date || null,
      payload.audit_type || current.audit_type || null,
      payload.source_sheet || current.source_sheet || null,
      payload.source_row || current.source_row || null,
      current.report_id
    ]
  );

  await db.query(
    `UPDATE sangket_observations
     SET observation_no = ?, observation_text = ?, potential_damage_amount = ?, severity_case = ?, category_id = ?, status = ?, responsible_user_id = ?, due_date = ?, resolved_date = ?, remark = ?, source_sheet = ?, source_row = ?
     WHERE id = ?`,
    [
      payload.observation_no || current.observation_no || null,
      payload.observation_text || payload.sang_detail || current.observation_text || null,
      payload.potential_damage_amount ?? payload.sang_money ?? current.potential_damage_amount ?? null,
      payload.severity_case || payload.sang_severity_case || current.severity_case || null,
      payload.category_id || current.category_id || null,
      payload.status || current.status || 'new',
      payload.responsible_user_id || current.responsible_user_id || null,
      payload.due_date || current.due_date || null,
      payload.resolved_date || current.resolved_date || null,
      payload.remark || payload.sang_maihed || current.remark || null,
      payload.source_sheet || current.source_sheet || null,
      payload.source_row || current.source_row || null,
      id
    ]
  );

  await syncCategories(
    id,
    payload.category_id || current.category_id || null,
    normalizeArray(payload.category_ids.length ? payload.category_ids : current.category_ids)
  );

  if (payload.action_type || payload.letter_no || payload.action_detail || payload.result) {
    await addObservationAction(id, {
      action_type: payload.action_type || severityActionType(payload.severity_case || current.severity_case),
      letter_no: payload.letter_no || null,
      letter_date: payload.letter_date || null,
      action_detail: payload.action_detail || null,
      result: payload.result || null,
      created_by: payload.created_by || payload.sang_saveby || 'system'
    });
  }

  return id;
}

async function deleteObservation(id) {
  await ensureSchema();
  const observation = await getById(id);
  if (!observation) return null;

  await db.query('DELETE FROM sangket_observation_actions WHERE observation_id = ?', [id]);
  await db.query('DELETE FROM sangket_observation_category_map WHERE observation_id = ?', [id]);
  await db.query('DELETE FROM sangket_observations WHERE id = ?', [id]);

  const [[reportCountRow]] = await db.query(
    'SELECT COUNT(*) AS total FROM sangket_observations WHERE audit_report_id = ?',
    [observation.report_id]
  );
  if (Number(reportCountRow.total || 0) === 0) {
    await db.query('DELETE FROM sangket_audit_reports WHERE id = ?', [observation.report_id]);

    const [[coopCountRow]] = await db.query(
      'SELECT COUNT(*) AS total FROM sangket_audit_reports WHERE cooperative_id = ?',
      [observation.cooperative_id]
    );
    if (Number(coopCountRow.total || 0) === 0) {
      await db.query('DELETE FROM sangket_cooperatives WHERE id = ?', [observation.cooperative_id]);
    }
  }

  return true;
}

async function getById(id) {
  await ensureSchema();
  const rows = await fetchObservationRows('WHERE o.id = ?', [id]);
  const row = rows[0];
  if (!row) return null;

  const [actions] = await db.query(
    `SELECT *
     FROM sangket_observation_actions
     WHERE observation_id = ?
     ORDER BY created_at DESC, id DESC`,
    [id]
  );

  const [withCategories] = await attachCategories([row]);
  return {
    ...withCategories,
    id: withCategories.observation_id,
    actions
  };
}

async function getPaged(filters = {}, page = 1, pageSize = 10) {
  await ensureSchema();
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 10);
  const offset = (safePage - 1) * safePageSize;
  const { whereSql, params } = buildWhere(filters);

  const [[countRow]] = await db.query(
    `SELECT COUNT(DISTINCT o.id) AS total
     FROM sangket_observations o
     INNER JOIN sangket_audit_reports r ON r.id = o.audit_report_id
     INNER JOIN sangket_cooperatives c ON c.id = r.cooperative_id
     ${whereSql}`,
    params
  );

  const rows = await fetchObservationRows(whereSql, [...params, safePageSize, offset], 'LIMIT ? OFFSET ?');
  const pagedRows = await attachCategories(rows);
  return { rows: pagedRows, total: Number(countRow.total || 0) };
}

async function getExportRows(filters = {}) {
  await ensureSchema();
  const { whereSql, params } = buildWhere(filters);
  const rows = await fetchObservationRows(whereSql, params);
  return attachCategories(rows);
}

async function getDashboard(filters = {}) {
  await ensureSchema();
  const { whereSql, params } = buildWhere(filters);
  const baseFrom = `
     FROM sangket_observations o
     INNER JOIN sangket_audit_reports r ON r.id = o.audit_report_id
     INNER JOIN sangket_cooperatives c ON c.id = r.cooperative_id
  `;

  const [[summaryRow]] = await db.query(
    `SELECT
      COUNT(DISTINCT o.id) AS total_observations,
      COALESCE(SUM(COALESCE(o.potential_damage_amount, 0)), 0) AS total_damage,
      SUM(CASE WHEN o.status IN ('new', 'in_progress', 'monitoring') THEN 1 ELSE 0 END) AS open_items,
      SUM(CASE WHEN o.due_date IS NOT NULL AND o.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS due_soon
     ${baseFrom}
     ${whereSql}`,
    params
  );

  const [statusRows] = await db.query(
    `SELECT o.status, COUNT(DISTINCT o.id) AS total
     ${baseFrom}
     ${whereSql}
     GROUP BY o.status
     ORDER BY total DESC`,
    params
  );

  const [groupRows] = await db.query(
    `SELECT COALESCE(c.promotion_group_no, 0) AS group_no, COUNT(DISTINCT o.id) AS total
     ${baseFrom}
     ${whereSql}
     GROUP BY COALESCE(c.promotion_group_no, 0)
     ORDER BY group_no ASC`,
    params
  );

  const [categoryRows] = await db.query(
    `SELECT cat.id, cat.name, COUNT(DISTINCT o.id) AS total
     FROM sangket_observation_categories cat
     LEFT JOIN sangket_observation_category_map map ON map.category_id = cat.id
     LEFT JOIN sangket_observations o ON o.id = map.observation_id
     LEFT JOIN sangket_audit_reports r ON r.id = o.audit_report_id
     LEFT JOIN sangket_cooperatives c ON c.id = r.cooperative_id
     ${whereSql}
     GROUP BY cat.id, cat.name, cat.sort_order
     ORDER BY cat.sort_order ASC`,
    params
  );

  const [dueSoonRows] = await db.query(
    `SELECT
      o.id AS observation_id,
      o.observation_no,
      o.observation_text,
      o.status,
      o.due_date,
      c.name AS cooperative_name,
      c.c_code AS cooperative_code,
      c.promotion_group_no,
      r.fiscal_year_end,
      r.audit_office_letter_no
     ${baseFrom}
     ${whereSql ? `${whereSql} AND ` : 'WHERE '}
      o.status IN ('new', 'in_progress', 'monitoring')
      AND o.due_date IS NOT NULL
      AND o.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)
     ORDER BY o.due_date ASC
     LIMIT 10`,
    params
  );

  const latest = await getPaged(filters, 1, 8);

  return {
    summary: {
      total_observations: Number(summaryRow.total_observations || 0),
      total_damage: Number(summaryRow.total_damage || 0),
      open_items: Number(summaryRow.open_items || 0),
      due_soon: Number(summaryRow.due_soon || 0)
    },
    statusRows,
    groupRows,
    categoryRows,
    dueSoonRows,
    latestRows: latest.rows
  };
}

async function getCategoryOptions() {
  await ensureSchema();
  const [rows] = await db.query(
    'SELECT id, name, sort_order FROM sangket_observation_categories ORDER BY sort_order ASC'
  );
  return rows;
}

async function getReferenceData() {
  await ensureSchema();
  const [groups] = await db.query(
    `SELECT DISTINCT c.promotion_group_no AS group_no
     FROM sangket_cooperatives c
     WHERE c.promotion_group_no IS NOT NULL
     ORDER BY c.promotion_group_no ASC`
  );
  const [cooperatives] = await db.query(
    `SELECT id, c_code, name, coop_type, promotion_group_no
     FROM sangket_cooperatives
     ORDER BY promotion_group_no ASC, name ASC`
  );
  const activeCoopHierarchy = await getActiveCoopHierarchy();
  const categories = await getCategoryOptions();
  return { groups, cooperatives, categories, activeCoopHierarchy };
}

async function importWorkbook(filePath, uploadedBy = 'system') {
  await ensureSchema();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const summary = {
    sheets: 0,
    cooperatives: 0,
    reports: 0,
    observations: 0,
    actions: 0
  };

  for (const sheet of workbook.worksheets) {
    summary.sheets += 1;
    const promotionGroupNo = parsePromotionGroupNo(sheet.name);
    const coopType = coopTypeFromSheet(sheet.name);
    let currentReportId = null;
    let currentCooperativeId = null;
    let currentObservationNo = 0;

    for (let r = 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r).values.slice(1).map(textValue);
      const observationNo = numberValue(row[0]);
      const cooperativeName = textValue(row[1]);
      const fiscalYearEnd = dateText(row[2]);
      const auditOfficeLetterNo = textValue(row[3]);
      const receivedDate = textValue(row[4]);
      const auditorName = textValue(row[5]);
      const auditType = auditTypeFromRow(sheet.getRow(r).values.slice(1));
      const observationText = textValue(row[8]);
      const potentialDamageAmount = numberValue(row[9]);
      const severityCase = severityFromRow(sheet.getRow(r).values.slice(1));
      const primaryCategoryId = categoryIdsFromRow(sheet.getRow(r).values.slice(1))[0] || null;
      const categoryIds = categoryIdsFromRow(sheet.getRow(r).values.slice(1));
      const actionLetterNo = textValue(row[13]);
      const actionLetterDate = textValue(row[14]);

      const hasNewReport = Boolean(observationNo && cooperativeName);
      if (hasNewReport) {
        currentCooperativeId = await findOrCreateCooperative({
          name: cooperativeName,
          cCode: null,
          coopType,
          promotionGroupNo,
          district: null,
          status: null
        });
        summary.cooperatives += 1;

        currentReportId = await findOrCreateReport({
          cooperative_id: currentCooperativeId,
          fiscal_year_end: fiscalYearEnd,
          auditor_name: auditorName,
          audit_office_letter_no: auditOfficeLetterNo,
          audit_office_letter_date: actionLetterDate || null,
          received_date: receivedDate,
          audit_type: auditType,
          source_sheet: sheet.name,
          source_row: r
        });
        summary.reports += 1;
        currentObservationNo = observationNo || currentObservationNo;
      } else if (currentReportId && observationText) {
        currentObservationNo += 1;
      }

      if (!currentReportId || !observationText) {
        continue;
      }

      const [result] = await db.query(
        `INSERT INTO sangket_observations
          (audit_report_id, observation_no, observation_text, potential_damage_amount, severity_case, category_id, status, responsible_user_id, due_date, resolved_date, remark, source_sheet, source_row)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          currentReportId,
          observationNo || currentObservationNo || null,
          observationText,
          potentialDamageAmount,
          severityCase,
          primaryCategoryId,
          severityCase === 'serious_order' ? 'new' : 'monitoring',
          null,
          null,
          null,
          null,
          sheet.name,
          r
        ]
      );
      summary.observations += 1;

      await syncCategories(result.insertId, primaryCategoryId, categoryIds);

      if (actionLetterNo || actionLetterDate || severityCase) {
        await addObservationAction(result.insertId, {
          action_type: severityActionType(severityCase),
          letter_no: actionLetterNo || null,
          letter_date: actionLetterDate || null,
          action_detail: observationText,
          result: null,
          created_by: uploadedBy
        });
        summary.actions += 1;
      }
    }
  }

  return summary;
}

module.exports = {
  ensureSchema,
  getDashboard,
  getPaged,
  getExportRows,
  getById,
  getCategoryOptions,
  getReferenceData,
  create,
  update,
  delete: deleteObservation,
  addAction: addObservationAction,
  importWorkbook,
  CATEGORY_SEED
};
