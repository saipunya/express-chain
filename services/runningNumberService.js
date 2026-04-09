const db = require('../config/db');

const TABLE_CONFIG = {
  official_travel_requests: { numberColumn: 'request_no', dateColumn: 'request_date', prefix: 'TR' },
  vehicle_requests: { numberColumn: 'vehicle_request_no', dateColumn: 'request_date', prefix: 'VR' }
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
  const pattern = `${config.prefix}-${thaiYear}-%`;
  const sql = `
    SELECT ${config.numberColumn} AS latestNumber
    FROM ${tableName}
    WHERE ${config.numberColumn} LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [pattern]);

  const latest = rows[0]?.latestNumber;
  const sequence = latest ? Number(String(latest).split('-').pop()) + 1 : 1;
  return `${config.prefix}-${thaiYear}-${String(sequence).padStart(4, '0')}`;
}

module.exports = {
  generateRunningNumber
};