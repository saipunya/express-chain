const db = require('../config/db');

let ensureTablePromise = null;

function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS pdf_chunks (
        id INT(11) NOT NULL AUTO_INCREMENT,
        chunk_text TEXT NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci
    `);
  }

  return ensureTablePromise;
}

exports.insertChunks = async (chunks = []) => {
  await ensureTable();

  if (!Array.isArray(chunks) || !chunks.length) {
    return {
      insertedCount: 0
    };
  }

  const values = chunks
    .map((chunk) => [String(chunk || '').trim()])
    .filter((row) => row[0].length > 0);

  if (!values.length) {
    return {
      insertedCount: 0
    };
  }

  await db.query(
    `
      INSERT INTO pdf_chunks (chunk_text)
      VALUES ?
    `,
    [values]
  );

  return {
    insertedCount: values.length
  };
};

function buildSearchTerms(message) {
  return String(message || '')
    .split(/[\s,;|/\\()\[\]{}]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 8);
}

exports.searchRelevantChunks = async (message, limit = 5) => {
  await ensureTable();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
  const terms = buildSearchTerms(message);

  if (!terms.length) {
    const [latestRows] = await db.query(
      `
        SELECT id, chunk_text, created_at
        FROM pdf_chunks
        ORDER BY id DESC
        LIMIT ?
      `,
      [safeLimit]
    );

    return latestRows;
  }

  const whereSql = terms.map(() => 'chunk_text LIKE ?').join(' OR ');
  const whereParams = terms.map((term) => `%${term}%`);

  const [rows] = await db.query(
    `
      SELECT id, chunk_text, created_at
      FROM pdf_chunks
      WHERE ${whereSql}
      ORDER BY id DESC
      LIMIT ?
    `,
    [...whereParams, safeLimit]
  );

  if (rows.length) {
    return rows;
  }

  const [fallbackRows] = await db.query(
    `
      SELECT id, chunk_text, created_at
      FROM pdf_chunks
      ORDER BY id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return fallbackRows;
};
