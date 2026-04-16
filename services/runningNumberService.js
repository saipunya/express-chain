const db = require('../config/db');

const TABLE_CONFIG = {
  official_travel_requests: {
    numberColumn: 'request_no',
    settingsKey: 'official_travel_requests',
    defaults: {
      prefix: 'ชย 0010(ดท)/',
      nextNumber: 1,
      paddingLength: 3
    },
    formatNumber: ({ prefix, sequence, paddingLength }) => `${prefix}${String(sequence).padStart(paddingLength, '0')}`,
    extractSequence: (value) => {
      const match = String(value || '').match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    }
  },
  vehicle_requests: {
    numberColumn: 'vehicle_request_no',
    settingsKey: null,
    prefix: 'VR',
    formatNumber: ({ sequence, thaiYear }) => `VR-${thaiYear}-${String(sequence).padStart(4, '0')}`,
    extractSequence: (value) => {
      const match = String(value || '').match(/-(\d+)$/);
      return match ? Number(match[1]) : 0;
    }
  }
};

let ensureSettingsTablePromise = null;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTableConfig(tableName) {
  const config = TABLE_CONFIG[tableName];
  if (!config) {
    throw new Error(`Unsupported running number table: ${tableName}`);
  }
  return config;
}

function toThaiYear(value) {
  const date = value ? new Date(value) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return year + 543;
}

async function ensureRunningNumberSettingsTable() {
  if (!ensureSettingsTablePromise) {
    ensureSettingsTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS running_number_settings (
        table_name VARCHAR(100) NOT NULL PRIMARY KEY,
        prefix VARCHAR(255) NOT NULL,
        next_number INT NOT NULL DEFAULT 1,
        padding_length INT NOT NULL DEFAULT 3,
        updated_by VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch((error) => {
      ensureSettingsTablePromise = null;
      throw error;
    });
  }

  await ensureSettingsTablePromise;
}

function normalizeSettingsRow(row, defaults) {
  return {
    prefix: row?.prefix || defaults.prefix,
    nextNumber: toPositiveInt(row?.next_number, defaults.nextNumber || 1),
    paddingLength: toPositiveInt(row?.padding_length, defaults.paddingLength || 3),
    updatedAt: row?.updated_at || null,
    createdAt: row?.created_at || null,
    updatedBy: row?.updated_by || null
  };
}

async function findLatestSequence(connection, tableName, numberColumn, extractSequence, prefixPattern) {
  const [rows] = await connection.query(
    `
      SELECT ${numberColumn} AS latestNumber
      FROM ${tableName}
      WHERE ${numberColumn} LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [`${prefixPattern}%`]
  );

  return extractSequence(rows[0]?.latestNumber);
}

async function getOfficialTravelRunningNumberSettings() {
  const config = getTableConfig('official_travel_requests');
  const defaults = config.defaults;

  await ensureRunningNumberSettingsTable();

  const [rows] = await db.query(
    'SELECT * FROM running_number_settings WHERE table_name = ? LIMIT 1',
    [config.settingsKey]
  );
  const row = rows[0];
  const settings = normalizeSettingsRow(row, defaults);

  if (!row) {
    const latestSequence = await findLatestSequence(
      db,
      'official_travel_requests',
      config.numberColumn,
      config.extractSequence,
      settings.prefix
    );
    settings.nextNumber = Math.max(settings.nextNumber, latestSequence + 1);
  }

  return settings;
}

async function previewRunningNumber(tableName, dateValue = null) {
  const config = getTableConfig(tableName);

  if (config.settingsKey) {
    const settings = await getOfficialTravelRunningNumberSettings();
    return config.formatNumber({
      prefix: settings.prefix,
      sequence: settings.nextNumber,
      paddingLength: settings.paddingLength
    });
  }

  const thaiYear = String(toThaiYear(dateValue));
  const [rows] = await db.query(
    `
      SELECT ${config.numberColumn} AS latestNumber
      FROM ${tableName}
      WHERE ${config.numberColumn} LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [`${config.prefix}-${thaiYear}-%`]
  );

  const latestSequence = config.extractSequence(rows[0]?.latestNumber);
  return config.formatNumber({
    sequence: latestSequence + 1,
    thaiYear
  });
}

async function reserveOfficialTravelNumber(connection, actorName = null) {
  const config = getTableConfig('official_travel_requests');
  const defaults = config.defaults;

  const [rows] = await connection.query(
    'SELECT * FROM running_number_settings WHERE table_name = ? LIMIT 1 FOR UPDATE',
    [config.settingsKey]
  );

  let settings = normalizeSettingsRow(rows[0], defaults);

  if (!rows[0]) {
    const latestSequence = await findLatestSequence(
      connection,
      'official_travel_requests',
      config.numberColumn,
      config.extractSequence,
      settings.prefix
    );
    settings.nextNumber = Math.max(settings.nextNumber, latestSequence + 1);

    await connection.query(
      `
        INSERT INTO running_number_settings (table_name, prefix, next_number, padding_length, updated_by)
        VALUES (?, ?, ?, ?, ?)
      `,
      [config.settingsKey, settings.prefix, settings.nextNumber, settings.paddingLength, actorName]
    );
  }

  const sequence = settings.nextNumber;
  await connection.query(
    `
      UPDATE running_number_settings
      SET next_number = ?, updated_by = ?
      WHERE table_name = ?
    `,
    [sequence + 1, actorName, config.settingsKey]
  );

  return config.formatNumber({
    prefix: settings.prefix,
    sequence,
    paddingLength: settings.paddingLength
  });
}

async function generateRunningNumber(tableName, dateValue = null, options = {}) {
  const config = getTableConfig(tableName);

  if (config.settingsKey) {
    await ensureRunningNumberSettingsTable();
    const actorName = options.actorName || null;

    if (options.connection) {
      return reserveOfficialTravelNumber(options.connection, actorName);
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const runningNumber = await reserveOfficialTravelNumber(connection, actorName);
      await connection.commit();
      return runningNumber;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return previewRunningNumber(tableName, dateValue);
}

async function updateOfficialTravelRunningNumberSettings(payload = {}, actorName = null) {
  const config = getTableConfig('official_travel_requests');
  const defaults = config.defaults;

  await ensureRunningNumberSettingsTable();

  const prefix = String(payload.prefix || '').trim() || defaults.prefix;
  const nextNumber = toPositiveInt(payload.nextNumber, defaults.nextNumber || 1);
  const paddingLength = Math.min(10, toPositiveInt(payload.paddingLength, defaults.paddingLength || 3));

  await db.query(
    `
      INSERT INTO running_number_settings (table_name, prefix, next_number, padding_length, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        prefix = VALUES(prefix),
        next_number = VALUES(next_number),
        padding_length = VALUES(padding_length),
        updated_by = VALUES(updated_by)
    `,
    [config.settingsKey, prefix, nextNumber, paddingLength, actorName]
  );

  return {
    prefix,
    nextNumber,
    paddingLength
  };
}

module.exports = {
  ensureRunningNumberSettingsTable,
  generateRunningNumber,
  getOfficialTravelRunningNumberSettings,
  previewRunningNumber,
  updateOfficialTravelRunningNumberSettings
};
