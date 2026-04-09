const db = require('../config/db');

const TABLE_CONFIG = {
  official_travel_requests: {
    numberColumn: 'request_no',
    dateColumn: 'request_date',
    prefix: 'ชย 0010(ดท)/',
    patternPrefix: 'ชย 0010(ดท)/',
    formatNumber: (sequence) => `ชย 0010(ดท)/${String(sequence).padStart(4, '0')}`,
    extractSequence: (value) => {
      const match = String(value || '').match(/\/(\d+)$/);
      return match ? Number(match[1]) : 0;
    }
  },
  vehicle_requests: {
    numberColumn: 'vehicle_request_no',
    dateColumn: 'request_date',
    prefix: 'VR',
    patternPrefix: null,
    formatNumber: (sequence, thaiYear) => `VR-${thaiYear}-${String(sequence).padStart(4, '0')}`,
    extractSequence: (value) => {
      const match = String(value || '').match(/-(\d+)$/);
      return match ? Number(match[1]) : 0;
    }
  }
};

function toThaiYear(value) {
  const date = value ? new Date(value) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return year + 543;
}

async function generateRunningNumber(tableName, dateValue) {
  const config = TABLE_CONFIG[tableName];
  if (!config) {
    throw new Error(`Unsupported running number table: ${tableName}`);
  }

  const thaiYear = String(toThaiYear(dateValue));
  const pattern = config.patternPrefix ? `${config.patternPrefix}%` : `${config.prefix}-${thaiYear}-%`;
  const sql = `
    SELECT ${config.numberColumn} AS latestNumber
    FROM ${tableName}
    WHERE ${config.numberColumn} LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `;
  let rows;
  try {
    [rows] = await db.query(sql, [pattern]);
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      rows = [];
    } else {
      throw error;
    }
  }

  const latest = rows[0]?.latestNumber;
  const latestSequence = latest ? config.extractSequence(latest) : 0;
  const sequence = latestSequence + 1;
  return config.formatNumber(sequence, thaiYear);
}

module.exports = {
  generateRunningNumber
};